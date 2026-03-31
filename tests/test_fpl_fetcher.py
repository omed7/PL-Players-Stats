import json
import sys
import unittest
from unittest.mock import patch, MagicMock
import os

# Mock requests module before importing fpl_fetcher
sys.modules['requests'] = MagicMock()

import fpl_fetcher

class TestFplFetcher(unittest.TestCase):
    @patch('fpl_fetcher.requests')
    @patch('fpl_fetcher.time.sleep')
    @patch('builtins.print')
    def test_history_api_exception_handling(self, mock_print, mock_sleep, mock_requests):
        """
        Test that if the history API throws an exception or returns invalid JSON for one player,
        it skips that player and continues to the next.
        """
        # Mocking the initial bootstrap response
        mock_bootstrap_resp = MagicMock()
        mock_bootstrap_resp.json.return_value = {
            'teams': [
                {'id': 1, 'short_name': 'ARS', 'code': 3}
            ],
            'elements': [
                # Player 1 (will fail on history API)
                {
                    'id': 100,
                    'web_name': 'Player A',
                    'team': 1,
                    'element_type': 3,
                    'now_cost': 50,
                    'chance_of_playing_next_round': 100,
                    'minutes': 90
                },
                # Player 2 (will succeed)
                {
                    'id': 101,
                    'web_name': 'Player B',
                    'team': 1,
                    'element_type': 4,
                    'now_cost': 100,
                    'chance_of_playing_next_round': 100,
                    'minutes': 90
                }
            ]
        }

        # Mock the history API responses
        mock_history_resp_success = MagicMock()
        mock_history_resp_success.json.return_value = {
            'history': [
                {'minutes': 90, 'expected_goals': '1.0', 'total_points': 5}
            ] * 10 # Provide 10 matches of history
        }

        # Requests.get will be called:
        # 1. Once for bootstrap URL
        # 2. Once for Player 1 history (Exception)
        # 3. Once for Player 2 history (Success)

        def side_effect_requests_get(url, *args, **kwargs):
            if "bootstrap-static" in url:
                return mock_bootstrap_resp
            elif "element-summary/100" in url:
                # Simulate a generic network/requests exception for Player 1
                raise Exception("Mocked connection error")
            elif "element-summary/101" in url:
                return mock_history_resp_success
            else:
                raise ValueError(f"Unexpected URL requested: {url}")

        mock_requests.get.side_effect = side_effect_requests_get

        # Mock file writing to avoid destroying the real players.json file
        m_open = unittest.mock.mock_open()
        with patch('builtins.open', m_open):
            # Run the fetcher
            fpl_fetcher.get_fpl_data()

            # Verify the exception was logged for Player A (ID 100)
            mock_print.assert_any_call("Error processing player 100: Mocked connection error")

            # Ensure open was called with correct arguments
            m_open.assert_called_once_with("players.json", "w", encoding="utf-8")

            # Capture the arguments sent to write()
            # Note: json.dump calls write() multiple times.
            handle = m_open()
            write_calls = handle.write.call_args_list
            written_content = "".join([call[0][0] for call in write_calls])

            data = json.loads(written_content)

            # We expect exactly 1 player in the output (Player B, ID 101)
            self.assertEqual(len(data), 1)
            self.assertEqual(data[0]["name"], "Player B")
            self.assertEqual(data[0]["price"], 10.0) # 100 / 10.0
            self.assertEqual(data[0]["position"], "FWD")

if __name__ == '__main__':
    unittest.main()
