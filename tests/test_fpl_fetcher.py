import unittest
from unittest.mock import patch, MagicMock, mock_open
import sys


# Mock requests before importing fpl_fetcher
class MockRequestException(Exception):
    pass


class MockTimeout(MockRequestException):
    pass


class MockConnectionError(MockRequestException):
    pass


mock_exceptions = MagicMock()
mock_exceptions.RequestException = MockRequestException
mock_exceptions.Timeout = MockTimeout
mock_exceptions.ConnectionError = MockConnectionError

mock_requests = MagicMock()
mock_requests.exceptions = mock_exceptions

sys.modules["requests"] = mock_requests

import fpl_fetcher  # noqa: E402


class TestGetFplData(unittest.TestCase):
    def setUp(self):
        self.mock_bootstrap = {
            "teams": [
                {"id": 1, "short_name": "ARS", "code": 3},
                {"id": 2, "short_name": "AVL", "code": 7},
            ],
            "elements": [
                {
                    "id": 1,
                    "web_name": "Saka",
                    "team": 1,
                    "element_type": 3,
                    "now_cost": 100,
                    "minutes": 100,
                    "chance_of_playing_next_round": 100,
                },
                {
                    "id": 2,
                    "web_name": "Watkins",
                    "team": 2,
                    "element_type": 4,
                    "now_cost": 90,
                    "minutes": 90,
                    "chance_of_playing_next_round": None,
                },
            ],
        }

        self.mock_history_saka = {
            "history": [
                {"minutes": 90, "total_points": 5, "expected_goals": 0.5},
                {"minutes": 90, "total_points": 2, "expected_goals": 0.1},
                {"minutes": 90, "total_points": 10, "expected_goals": 0.8},
                {"minutes": 90, "total_points": 1, "expected_goals": 0.0},
                {"minutes": 90, "total_points": 6, "expected_goals": 0.4},
            ]
        }

        self.mock_history_watkins = {
            "history": [{"minutes": 90, "total_points": 2, "expected_goals": 0.2}]
        }

    @patch("fpl_fetcher.ThreadPoolExecutor")
    @patch("fpl_fetcher.requests.Session")
    @patch("fpl_fetcher.requests.get")
    @patch("fpl_fetcher.json.dump")
    @patch("builtins.open", new_callable=mock_open)
    def test_get_fpl_data_success(
        self, mock_file, mock_json_dump, mock_get, mock_session, mock_executor
    ):
        def mock_submit(fn, *args, **kwargs):
            m = MagicMock()
            try:
                val = fn(*args, **kwargs)
                m.result.return_value = val
            except Exception as e:
                m.result.side_effect = e
            return m

        mock_executor.return_value.__enter__.return_value.submit.side_effect = (
            mock_submit
        )
        # Setup mock responses
        mock_resp_bootstrap = MagicMock()
        mock_resp_bootstrap.json.return_value = self.mock_bootstrap

        mock_resp_saka = MagicMock()
        mock_resp_saka.json.return_value = self.mock_history_saka

        mock_resp_watkins = MagicMock()
        mock_resp_watkins.json.return_value = self.mock_history_watkins

        mock_get.return_value = mock_resp_bootstrap

        def session_get_side_effect(url, *args, **kwargs):
            if str(url).endswith("/1/"):
                m = MagicMock()
                m.json.return_value = self.mock_history_saka
                return m
            elif str(url).endswith("/2/"):
                m = MagicMock()
                m.json.return_value = self.mock_history_watkins
                return m
            return MagicMock()

        mock_session.return_value.__enter__.return_value.get.side_effect = (
            session_get_side_effect
        )

        # Run the function
        fpl_fetcher.get_fpl_data()

        # Verify json.dump was called with correct data
        self.assertTrue(mock_json_dump.called)
        args, kwargs = mock_json_dump.call_args
        players_data = args[0]

        self.assertEqual(len(players_data), 2)
        self.assertEqual(players_data[0]["name"], "Saka")
        self.assertEqual(players_data[1]["name"], "Watkins")
        self.assertEqual(players_data[0]["last_5_points"], 24)  # 5+2+10+1+6
        self.assertEqual(players_data[1]["last_5_points"], 2)

    @patch("fpl_fetcher.ThreadPoolExecutor")
    @patch("fpl_fetcher.requests.Session")
    @patch("fpl_fetcher.requests.get")
    @patch("fpl_fetcher.json.dump")
    @patch("builtins.open", new_callable=mock_open)
    def test_get_fpl_data_empty_history(
        self, mock_file, mock_json_dump, mock_get, mock_session, mock_executor
    ):
        def mock_submit(fn, *args, **kwargs):
            m = MagicMock()
            try:
                val = fn(*args, **kwargs)
                m.result.return_value = val
            except Exception as e:
                m.result.side_effect = e
            return m

        mock_executor.return_value.__enter__.return_value.submit.side_effect = (
            mock_submit
        )
        # Setup mock responses: first success, second empty history
        mock_resp_bootstrap = MagicMock()
        mock_resp_bootstrap.json.return_value = self.mock_bootstrap

        mock_resp_saka = MagicMock()
        mock_resp_saka.json.return_value = self.mock_history_saka

        mock_resp_watkins_empty = MagicMock()
        mock_resp_watkins_empty.json.return_value = {"history": []}

        mock_get.return_value = mock_resp_bootstrap

        def session_get_side_effect(url, *args, **kwargs):
            if str(url).endswith("/1/"):
                m = MagicMock()
                m.json.return_value = self.mock_history_saka
                return m
            elif str(url).endswith("/2/"):
                m = MagicMock()
                m.json.return_value = {"history": []}
                return m
            return MagicMock()

        mock_session.return_value.__enter__.return_value.get.side_effect = (
            session_get_side_effect
        )

        fpl_fetcher.get_fpl_data()

        # Verify Watkins was skipped
        args, kwargs = mock_json_dump.call_args
        players_data = args[0]
        self.assertEqual(len(players_data), 1)
        self.assertEqual(players_data[0]["name"], "Saka")

    @patch("fpl_fetcher.ThreadPoolExecutor")
    @patch("fpl_fetcher.requests.Session")
    @patch("fpl_fetcher.requests.get")
    @patch("fpl_fetcher.json.dump")
    @patch("builtins.open", new_callable=mock_open)
    def test_get_fpl_data_api_error(
        self, mock_file, mock_json_dump, mock_get, mock_session, mock_executor
    ):
        def mock_submit(fn, *args, **kwargs):
            m = MagicMock()
            try:
                val = fn(*args, **kwargs)
                m.result.return_value = val
            except Exception as e:
                m.result.side_effect = e
            return m

        mock_executor.return_value.__enter__.return_value.submit.side_effect = (
            mock_submit
        )
        # Setup mock responses: first success, second raises Exception
        mock_resp_bootstrap = MagicMock()
        mock_resp_bootstrap.json.return_value = self.mock_bootstrap

        mock_resp_saka = MagicMock()
        mock_resp_saka.json.return_value = self.mock_history_saka

        import requests

        mock_get.return_value = mock_resp_bootstrap

        def session_get_side_effect(url, *args, **kwargs):
            if str(url).endswith("/1/"):
                m = MagicMock()
                m.json.return_value = self.mock_history_saka
                return m
            elif str(url).endswith("/2/"):
                raise requests.exceptions.RequestException("API Down")
            return MagicMock()

        mock_session.return_value.__enter__.return_value.get.side_effect = (
            session_get_side_effect
        )

        fpl_fetcher.get_fpl_data()

        # Verify Watkins was skipped but Saka processed
        args, kwargs = mock_json_dump.call_args
        if args:
            players_data = args[0]
            self.assertEqual(len(players_data), 1)
            self.assertEqual(players_data[0]["name"], "Saka")
        else:
            self.fail("json.dump was not called")

    @patch("fpl_fetcher.ThreadPoolExecutor")
    @patch("fpl_fetcher.requests.Session")
    @patch("fpl_fetcher.requests.get")
    @patch("fpl_fetcher.json.dump")
    @patch("builtins.open", new_callable=mock_open)
    def test_get_fpl_data_api_timeout(
        self, mock_file, mock_json_dump, mock_get, mock_session, mock_executor
    ):
        def mock_submit(fn, *args, **kwargs):
            m = MagicMock()
            try:
                val = fn(*args, **kwargs)
                m.result.return_value = val
            except Exception as e:
                m.result.side_effect = e
            return m

        mock_executor.return_value.__enter__.return_value.submit.side_effect = (
            mock_submit
        )
        import requests

        # Setup mock responses: first success, second raises Timeout
        mock_resp_bootstrap = MagicMock()
        mock_resp_bootstrap.json.return_value = self.mock_bootstrap

        mock_resp_saka = MagicMock()
        mock_resp_saka.json.return_value = self.mock_history_saka

        mock_get.return_value = mock_resp_bootstrap

        def session_get_side_effect(url, *args, **kwargs):
            if str(url).endswith("/1/"):
                m = MagicMock()
                m.json.return_value = self.mock_history_saka
                return m
            elif str(url).endswith("/2/"):
                raise requests.exceptions.Timeout("API Timeout")
            return MagicMock()

        mock_session.return_value.__enter__.return_value.get.side_effect = (
            session_get_side_effect
        )

        fpl_fetcher.get_fpl_data()

        # Verify Watkins was skipped but Saka processed
        args, kwargs = mock_json_dump.call_args
        if args:
            players_data = args[0]
            self.assertEqual(len(players_data), 1)
            self.assertEqual(players_data[0]["name"], "Saka")
        else:
            self.fail("json.dump was not called")

    @patch("fpl_fetcher.requests.get")
    @patch("builtins.print")
    def test_get_fpl_data_bootstrap_error(self, mock_print, mock_get):
        import requests

        mock_get.side_effect = requests.exceptions.ConnectionError("Connection Failed")

        fpl_fetcher.get_fpl_data()

        # Verify it prints an error and returns gracefully
        mock_print.assert_any_call("Error fetching bootstrap data: Connection Failed")


if __name__ == "__main__":
    unittest.main()
