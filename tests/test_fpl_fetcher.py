import sys
import json
import pytest
from unittest.mock import MagicMock, mock_open, patch

# Mock requests module before importing fpl_fetcher
sys.modules['requests'] = MagicMock()

import fpl_fetcher

@pytest.fixture
def mock_bootstrap_response():
    return {
        "teams": [
            {"id": 1, "short_name": "ARS", "code": 3, "name": "Arsenal"},
            {"id": 2, "short_name": "AVL", "code": 7, "name": "Aston Villa"}
        ],
        "elements": [
            {
                "id": 101,
                "web_name": "Saka",
                "team": 1,
                "element_type": 3, # MID
                "now_cost": 90, # 9.0
                "chance_of_playing_next_round": 100,
                "minutes": 90
            },
            {
                "id": 102,
                "web_name": "Watkins",
                "team": 2,
                "element_type": 4, # FWD
                "now_cost": 85, # 8.5
                "chance_of_playing_next_round": 75,
                "minutes": 90
            },
            {
                "id": 103,
                "web_name": "Ghost",
                "team": 1,
                "element_type": 3,
                "now_cost": 50,
                "chance_of_playing_next_round": 0,
                "minutes": 0 # Should be skipped
            }
        ]
    }

@pytest.fixture
def mock_history_response():
    def _history(player_id):
        if player_id == 101: # Saka
            return {
                "history": [
                    {
                        "minutes": 90,
                        "expected_goals": "0.5",
                        "expected_assists": "0.3",
                        "expected_goal_involvements": "0.8",
                        "expected_goals_conceded": "0.0",
                        "creativity": "25.0",
                        "threat": "40.0",
                        "ict_index": "10.5",
                        "bps": 20,
                        "bonus": 2,
                        "total_points": 8,
                        "saves": 0,
                        "recoveries": 3
                    }
                ] * 10 # 10 matches
            }
        elif player_id == 102: # Watkins
            return {
                "history": [
                    {
                        "minutes": 80,
                        "expected_goals": "0.8",
                        "expected_assists": "0.1",
                        "expected_goal_involvements": "0.9",
                        "expected_goals_conceded": "1.0",
                        "creativity": "10.0",
                        "threat": "60.0",
                        "ict_index": "12.0",
                        "bps": 15,
                        "bonus": 0,
                        "total_points": 5,
                        "saves": 0,
                        "clearances_blocks_interceptions": 1
                    }
                ] * 5 # 5 matches
            }
        return {"history": []}
    return _history

@patch('fpl_fetcher.requests')
@patch('builtins.open', new_callable=mock_open)
@patch('fpl_fetcher.time.sleep', return_value=None)
def test_get_fpl_data_success(mock_sleep, mock_file, mock_requests, mock_bootstrap_response, mock_history_response):
    # Setup mock returns
    def side_effect(url, headers=None):
        mock_resp = MagicMock()
        if "bootstrap-static" in url:
            mock_resp.json.return_value = mock_bootstrap_response
        elif "element-summary" in url:
            player_id = int(url.split('/')[-2])
            mock_resp.json.return_value = mock_history_response(player_id)
        return mock_resp

    mock_requests.get.side_effect = side_effect

    # Run the function
    fpl_fetcher.get_fpl_data()

    # Verify open was called correctly
    mock_file.assert_called_once_with("players.json", "w", encoding="utf-8")

    # Extract written JSON content
    written_data = "".join(call.args[0] for call in mock_file().write.call_args_list)
    parsed_data = json.loads(written_data)

    # Verify we processed exactly 2 players (one skipped due to 0 minutes)
    assert len(parsed_data) == 2

    # Verify Saka's data
    saka = next((p for p in parsed_data if p['name'] == 'Saka'), None)
    assert saka is not None
    assert saka['team'] == 'ARS'
    assert saka['logo'] == 'https://resources.premierleague.com/premierleague/badges/t3.png'
    assert saka['position'] == 'MID'
    assert saka['price'] == 9.0
    assert saka['status_pct'] == 100

    # Check last 5 stats for Saka (10 matches history)
    assert saka['last_5_minutes'] == 5 * 90
    assert saka['last_5_min_pct'] == 100
    assert saka['last_5_xG'] == 2.5 # 5 * 0.5
    assert saka['last_5_points'] == 40 # 5 * 8
    assert saka['last_5_defcon'] == 15 # 5 * 3 recoveries

    # Check last 10 stats for Saka
    assert saka['last_10_minutes'] == 10 * 90
    assert saka['last_10_xG'] == 5.0 # 10 * 0.5
    assert saka['last_10_points'] == 80 # 10 * 8

    # Verify Watkins's data
    watkins = next((p for p in parsed_data if p['name'] == 'Watkins'), None)
    assert watkins is not None
    assert watkins['team'] == 'AVL'
    assert watkins['position'] == 'FWD'
    assert watkins['price'] == 8.5
    assert watkins['status_pct'] == 75

    # Check last 5 stats for Watkins (5 matches history)
    assert watkins['last_5_minutes'] == 5 * 80
    assert watkins['last_5_min_pct'] == round((400 / 450) * 100) # (5*80) / (5*90)
    assert watkins['last_5_xG'] == 4.0 # 5 * 0.8
    assert watkins['last_5_defcon'] == 5 # 5 * 1 clearances_blocks_interceptions

    # Check last 10 stats for Watkins (only 5 matches available, should handle correctly)
    assert watkins['last_10_minutes'] == 5 * 80
    assert watkins['last_10_xG'] == 4.0

@patch('fpl_fetcher.requests')
@patch('builtins.open', new_callable=mock_open)
@patch('fpl_fetcher.time.sleep', return_value=None)
def test_get_fpl_data_handles_exceptions(mock_sleep, mock_file, mock_requests, mock_bootstrap_response, mock_history_response):
    # Setup mock returns where the second player throws an exception
    def side_effect(url, headers=None):
        mock_resp = MagicMock()
        if "bootstrap-static" in url:
            mock_resp.json.return_value = mock_bootstrap_response
        elif "element-summary/101/" in url:
            mock_resp.json.return_value = mock_history_response(101)
        elif "element-summary/102/" in url:
            raise Exception("API failure")
        return mock_resp

    mock_requests.get.side_effect = side_effect

    # Run the function
    fpl_fetcher.get_fpl_data()

    # Extract written JSON content
    written_data = "".join(call.args[0] for call in mock_file().write.call_args_list)
    parsed_data = json.loads(written_data)

    # Verify only 1 player was processed successfully (Saka), and Watkins was skipped due to exception
    assert len(parsed_data) == 1
    assert parsed_data[0]['name'] == 'Saka'

@patch('fpl_fetcher.requests')
@patch('builtins.open', new_callable=mock_open)
@patch('fpl_fetcher.time.sleep', return_value=None)
def test_get_fpl_data_empty_history(mock_sleep, mock_file, mock_requests, mock_bootstrap_response):
    # Setup mock returns where the player has empty history
    def side_effect(url, headers=None):
        mock_resp = MagicMock()
        if "bootstrap-static" in url:
            # Only keep one player for this test
            resp = mock_bootstrap_response.copy()
            resp['elements'] = [resp['elements'][0]]
            mock_resp.json.return_value = resp
        elif "element-summary" in url:
            # Return empty history
            mock_resp.json.return_value = {"history": []}
        return mock_resp

    mock_requests.get.side_effect = side_effect

    # Run the function
    fpl_fetcher.get_fpl_data()

    # Extract written JSON content
    written_data = "".join(call.args[0] for call in mock_file().write.call_args_list)
    parsed_data = json.loads(written_data)

    # Player with no history should be skipped
    assert len(parsed_data) == 0
