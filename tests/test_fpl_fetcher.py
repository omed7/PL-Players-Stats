import sys
from unittest.mock import MagicMock, mock_open, patch

import json  # noqa: E402

# Mock the requests module before importing fpl_fetcher
mock_requests = MagicMock()
sys.modules["requests"] = mock_requests

import fpl_fetcher  # noqa: E402


def test_mock_setup():
    assert "requests" in sys.modules
    assert sys.modules["requests"] is mock_requests


def test_get_fpl_data_happy_path():
    # Mock data for bootstrap-static API
    bootstrap_data = {
        "teams": [{"id": 1, "short_name": "ARS", "code": 3}],
        "elements": [
            {
                "id": 1,
                "web_name": "Saka",
                "team": 1,
                "element_type": 3,
                "now_cost": 100,
                "chance_of_playing_next_round": 100,
                "minutes": 90,
            }
        ],
    }

    # Mock data for element-summary API
    history_data = {
        "history": [
            {
                "minutes": 90,
                "expected_goals": "0.5",
                "expected_assists": "0.2",
                "expected_goal_involvements": "0.7",
                "expected_goals_conceded": "0.1",
                "creativity": "20.0",
                "threat": "30.0",
                "ict_index": "5.0",
                "bps": 20,
                "bonus": 3,
                "total_points": 8,
                "saves": 0,
                "clearances_blocks_interceptions": 1,
            }
        ]
        * 10  # Provide 10 matches of history
    }

    def side_effect_get(url, *args, **kwargs):
        mock_response = MagicMock()
        if "bootstrap-static" in url:
            mock_response.json.return_value = bootstrap_data
        elif "element-summary" in url:
            mock_response.json.return_value = history_data
        return mock_response

    mock_requests.get.side_effect = side_effect_get

    # Mock file writing to avoid disk I/O and verify correct writing
    m_open = mock_open()
    with patch("builtins.open", m_open), patch("fpl_fetcher.time.sleep"):
        fpl_fetcher.get_fpl_data()

    m_open.assert_called_once_with("players.json", "w", encoding="utf-8")

    # Extract the data written to the mock file
    handle = m_open()
    written_data = "".join(call.args[0] for call in handle.write.call_args_list)

    # Load the JSON data and verify contents
    players = json.loads(written_data)
    assert len(players) == 1

    player = players[0]
    assert player["name"] == "Saka"
    assert player["team"] == "ARS"
    assert (
        player["logo"]
        == "https://resources.premierleague.com/premierleague/badges/t3.png"
    )
    assert player["position"] == "MID"
    assert player["price"] == 10.0
    assert player["status_pct"] == 100

    # Verify some computed stats
    assert player["last_5_minutes"] == 450  # 5 * 90
    assert player["last_5_points"] == 40  # 5 * 8
    assert player["last_10_minutes"] == 900  # 10 * 90


def test_get_fpl_data_player_exception_handling():
    # Mock data for bootstrap-static API
    bootstrap_data = {
        "teams": [{"id": 1, "short_name": "ARS", "code": 3}],
        "elements": [
            {
                "id": 1,
                "web_name": "Saka",
                "team": 1,
                "element_type": 3,
                "now_cost": 100,
                "chance_of_playing_next_round": 100,
                "minutes": 90,
            },
            {
                "id": 2,
                "web_name": "Martinelli",
                "team": 1,
                "element_type": 3,
                "now_cost": 80,
                "chance_of_playing_next_round": 100,
                "minutes": 90,
            },
        ],
    }

    history_data = {
        "history": [
            {
                "minutes": 90,
                "expected_goals": "0.5",
                "total_points": 5,
            }
        ]
    }

    def side_effect_get(url, *args, **kwargs):
        mock_response = MagicMock()
        if "bootstrap-static" in url:
            mock_response.json.return_value = bootstrap_data
        elif "element-summary/1/" in url:
            mock_response.json.side_effect = Exception("API error for player 1")
        elif "element-summary/2/" in url:
            mock_response.json.return_value = history_data
        return mock_response

    mock_requests.get.side_effect = side_effect_get

    m_open = mock_open()
    with patch("builtins.open", m_open), patch("fpl_fetcher.time.sleep"):
        fpl_fetcher.get_fpl_data()

    m_open.assert_called_once_with("players.json", "w", encoding="utf-8")

    handle = m_open()
    written_data = "".join(call.args[0] for call in handle.write.call_args_list)
    players = json.loads(written_data)

    # Only player 2 should be in the results, player 1 skipped due to exception
    assert len(players) == 1
    assert players[0]["name"] == "Martinelli"


def test_get_fpl_data_empty_history():
    # If a player has no history, they should be skipped
    bootstrap_data = {
        "teams": [{"id": 1, "short_name": "ARS", "code": 3}],
        "elements": [
            {
                "id": 1,
                "web_name": "Saka",
                "team": 1,
                "element_type": 3,
                "now_cost": 100,
                "chance_of_playing_next_round": 100,
                "minutes": 90,
            }
        ],
    }

    def side_effect_get(url, *args, **kwargs):
        mock_response = MagicMock()
        if "bootstrap-static" in url:
            mock_response.json.return_value = bootstrap_data
        elif "element-summary" in url:
            mock_response.json.return_value = {"history": []}
        return mock_response

    mock_requests.get.side_effect = side_effect_get

    m_open = mock_open()
    with patch("builtins.open", m_open), patch("fpl_fetcher.time.sleep"):
        fpl_fetcher.get_fpl_data()

    handle = m_open()
    written_data = "".join(call.args[0] for call in handle.write.call_args_list)
    players = json.loads(written_data)

    # Player skipped due to empty history
    assert len(players) == 0


def test_get_fpl_data_missing_chance():
    # Test fallback to 100 if chance_of_playing_next_round is None/missing
    bootstrap_data = {
        "teams": [{"id": 1, "short_name": "ARS", "code": 3}],
        "elements": [
            {
                "id": 1,
                "web_name": "Saka",
                "team": 1,
                "element_type": 3,
                "now_cost": 100,
                "chance_of_playing_next_round": None,  # Null chance
                "minutes": 90,
            }
        ],
    }

    def side_effect_get(url, *args, **kwargs):
        mock_response = MagicMock()
        if "bootstrap-static" in url:
            mock_response.json.return_value = bootstrap_data
        elif "element-summary" in url:
            mock_response.json.return_value = {"history": [{"minutes": 90}]}
        return mock_response

    mock_requests.get.side_effect = side_effect_get

    m_open = mock_open()
    with patch("builtins.open", m_open), patch("fpl_fetcher.time.sleep"):
        fpl_fetcher.get_fpl_data()

    handle = m_open()
    written_data = "".join(call.args[0] for call in handle.write.call_args_list)
    players = json.loads(written_data)

    assert len(players) == 1
    assert players[0]["status_pct"] == 100
