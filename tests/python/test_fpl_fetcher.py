import unittest

from fpl_fetcher import (
    build_fixture_record,
    build_match_history_record,
    build_player_identity,
    sort_match_history,
)


class PlayerIdentityTests(unittest.TestCase):
    def test_builds_stable_player_and_team_identifiers(self):
        identity = build_player_identity(
            {"id": 101, "team": 7},
            {"short_name": "LIV", "logo": "https://example.test/liv.png"},
        )

        self.assertEqual(
            identity,
            {
                "element_id": 101,
                "team_id": 7,
                "team": "LIV",
                "logo": "https://example.test/liv.png",
            },
        )

    def test_rejects_missing_stable_player_identifier(self):
        with self.assertRaises(ValueError):
            build_player_identity(
                {"id": None, "team": 7},
                {"short_name": "LIV", "logo": ""},
            )


class MatchHistoryRecordTests(unittest.TestCase):
    def test_builds_a_full_completed_match_record_with_venue_and_stable_ids(self):
        record = build_match_history_record(
            {
                "fixture": 450,
                "round": 4,
                "opponent_team": 11,
                "was_home": False,
                "kickoff_time": "2026-09-12T14:00:00Z",
                "total_points": 8,
                "expected_goals": "0.42",
                "expected_assists": "0.17",
                "expected_goal_involvements": "0.59",
                "minutes": 0,
                "goals_scored": 1,
                "assists": 0,
                "clean_sheets": 0,
                "bonus": 2,
                "influence": "38.4",
                "creativity": "19.2",
                "threat": "42.0",
                "ict_index": "9.9",
                "bps": 27,
                "saves": 0,
                "defensive_contribution": 6,
            }
        )

        self.assertEqual(record["fixture_id"], 450)
        self.assertEqual(record["opponent_team_id"], 11)
        self.assertFalse(record["was_home"])
        self.assertEqual(record["minutes"], 0)
        self.assertEqual(record["goals"], 1)
        self.assertEqual(record["kickoff_time"], "2026-09-12T14:00:00Z")

    def test_rejects_match_history_without_a_stable_fixture_or_venue_fact(self):
        with self.assertRaises(ValueError):
            build_match_history_record(
                {"fixture": None, "opponent_team": 11, "was_home": True}
            )
        with self.assertRaises(ValueError):
            build_match_history_record(
                {"fixture": 450, "opponent_team": 11, "was_home": None}
            )

    def test_sorts_history_by_kickoff_then_fixture_id(self):
        records = [
            {"fixture_id": 22, "kickoff_time": "2026-08-15T14:00:00Z"},
            {"fixture_id": 21, "kickoff_time": "2026-08-15T14:00:00Z"},
            {"fixture_id": 30, "kickoff_time": "2026-08-22T14:00:00Z"},
        ]
        self.assertEqual(
            [record["fixture_id"] for record in sort_match_history(records)],
            [21, 22, 30],
        )


class FixtureRecordTests(unittest.TestCase):
    def setUp(self):
        self.teams = {
            1: {"short_name": "ARS", "logo": "https://example.test/ars.png"},
            7: {"short_name": "LIV", "logo": "https://example.test/liv.png"},
        }

    def test_home_fixture_uses_away_team_as_the_explicit_opponent(self):
        record = build_fixture_record(
            {
                "id": 90,
                "event": 3,
                "is_home": True,
                "team_h": 7,
                "team_a": 1,
                "difficulty": 2,
            },
            self.teams,
        )

        self.assertEqual(record["fixture_id"], 90)
        self.assertEqual(record["gw"], 3)
        self.assertEqual(record["opponent_id"], 1)
        self.assertEqual(record["opponent"], "ARS")
        self.assertTrue(record["is_home"])

    def test_rejects_fixture_without_a_valid_opponent_identifier(self):
        with self.assertRaises(ValueError):
            build_fixture_record(
                {"id": 90, "event": 3, "is_home": True, "team_h": 7},
                self.teams,
            )


if __name__ == "__main__":
    unittest.main()


class FetchReliabilityTests(unittest.TestCase):
    def test_fetch_json_rejects_non_successful_http_response(self):
        from unittest.mock import Mock
        from fpl_fetcher import fetch_json

        response = Mock()
        response.raise_for_status.side_effect = Exception("503 Service Unavailable")
        session = Mock()
        session.get.return_value = response

        with self.assertRaises(RuntimeError):
            fetch_json(session, "https://example.test/bootstrap", 10, "bootstrap")

    def test_write_json_atomically_replaces_only_completed_output(self):
        import json
        import tempfile
        from pathlib import Path
        from fpl_fetcher import write_json_atomically

        with tempfile.TemporaryDirectory() as temp_dir:
            output_path = Path(temp_dir) / "players.json"
            output_path.write_text('{"old": true}', encoding="utf-8")

            write_json_atomically({"players": [{"element_id": 1}]}, output_path)

            self.assertEqual(
                json.loads(output_path.read_text(encoding="utf-8")),
                {"players": [{"element_id": 1}]},
            )
            self.assertFalse((Path(temp_dir) / "players.json.tmp").exists())


class FetchCompletenessTests(unittest.TestCase):
    def test_allows_zero_player_output_before_the_first_current_gameweek(self):
        from fpl_fetcher import validate_fetch_completeness

        validate_fetch_completeness(
            element_count=400,
            player_record_count=0,
            successful_history_response_count=400,
            empty_history_count=400,
            season_is_live=False,
        )

    def test_rejects_empty_output_after_the_season_is_live(self):
        from fpl_fetcher import validate_fetch_completeness

        with self.assertRaises(RuntimeError):
            validate_fetch_completeness(
                element_count=400,
                player_record_count=0,
                successful_history_response_count=400,
                empty_history_count=400,
                season_is_live=True,
            )

    def test_rejects_failed_player_history_requests(self):
        from fpl_fetcher import validate_fetch_completeness

        with self.assertRaises(RuntimeError):
            validate_fetch_completeness(
                element_count=400,
                player_record_count=0,
                successful_history_response_count=0,
                empty_history_count=0,
                season_is_live=False,
            )
