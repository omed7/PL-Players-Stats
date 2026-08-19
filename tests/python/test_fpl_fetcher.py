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


class HistoryResponseIntegrityTests(unittest.TestCase):
    def test_rejects_empty_history_for_an_eligible_player_during_live_season(self):
        from fpl_fetcher import validate_completed_history

        with self.assertRaisesRegex(RuntimeError, "has no completed history"):
            validate_completed_history([], "Test Player", allow_empty=False)

    def test_allows_empty_history_before_the_season_is_live(self):
        from fpl_fetcher import validate_completed_history

        self.assertEqual(
            validate_completed_history([], "Test Player", allow_empty=True), []
        )

    def test_rejects_a_non_list_history_payload(self):
        from fpl_fetcher import validate_completed_history

        with self.assertRaisesRegex(RuntimeError, "must be a list"):
            validate_completed_history({}, "Test Player", allow_empty=False)

    def test_preserves_a_zero_minute_completed_row(self):
        from fpl_fetcher import validate_completed_history

        history = [{"fixture": 450, "minutes": 0}]

        self.assertIs(
            validate_completed_history(history, "Test Player", allow_empty=False),
            history,
        )


class ProcessedPlayerIntegrityTests(unittest.TestCase):
    def test_aborts_before_write_when_one_of_ten_eligible_histories_is_invalid(self):
        from unittest.mock import patch
        from fpl_fetcher import get_fpl_data

        elements = [
            {
                "id": player_id,
                "web_name": f"Player {player_id}",
                "team": 1,
                "element_type": 2,
                "minutes": 90,
                "now_cost": 50,
            }
            for player_id in range(1, 11)
        ]
        bootstrap = {
            "teams": [{"id": 1, "short_name": "TST", "code": 1}],
            "events": [
                {
                    "id": 1,
                    "is_current": True,
                    "is_next": False,
                    "finished": False,
                    "deadline_time": "2026-08-21T17:30:00Z",
                }
            ],
            "elements": elements,
        }

        def history_for(player_id):
            fixture_id = None if player_id == 10 else player_id
            return {
                "history": [
                    {
                        "fixture": fixture_id,
                        "round": 1,
                        "opponent_team": 1,
                        "was_home": True,
                        "kickoff_time": "2026-08-15T14:00:00Z",
                        "minutes": 90,
                    }
                ],
                "fixtures": [],
            }

        def fake_fetch_json(_session, url, _timeout, _label):
            if "bootstrap-static" in url:
                return bootstrap
            player_id = int(url.rstrip("/").split("/")[-1])
            return history_for(player_id)

        with patch("fpl_fetcher.fetch_json", side_effect=fake_fetch_json), patch(
            "fpl_fetcher.time.sleep"
        ), patch("fpl_fetcher.write_json_atomically") as write_json:
            with self.assertRaisesRegex(
                RuntimeError, "Failed to process eligible player Player 10 \\(10\\)"
            ):
                get_fpl_data()

        write_json.assert_not_called()


class FetchCompletenessTests(unittest.TestCase):
    def test_allows_zero_eligible_players_before_the_season_is_live(self):
        from fpl_fetcher import validate_fetch_completeness

        validate_fetch_completeness(
            element_count=0,
            player_record_count=0,
            empty_history_count=0,
            season_is_live=False,
        )

    def test_allows_all_eligible_histories_to_be_empty_before_the_season_is_live(self):
        from fpl_fetcher import validate_fetch_completeness

        validate_fetch_completeness(
            element_count=400,
            player_record_count=0,
            empty_history_count=400,
            season_is_live=False,
        )

    def test_rejects_zero_eligible_players_after_the_season_is_live(self):
        from fpl_fetcher import validate_fetch_completeness

        with self.assertRaisesRegex(RuntimeError, "zero eligible players"):
            validate_fetch_completeness(
                element_count=0,
                player_record_count=0,
                empty_history_count=0,
                season_is_live=True,
            )

    def test_rejects_any_missing_eligible_player_record(self):
        from fpl_fetcher import validate_fetch_completeness

        with self.assertRaisesRegex(RuntimeError, "399/400 player records"):
            validate_fetch_completeness(
                element_count=400,
                player_record_count=399,
                empty_history_count=0,
                season_is_live=True,
            )

    def test_accepts_an_exactly_complete_live_season_output(self):
        from fpl_fetcher import validate_fetch_completeness

        validate_fetch_completeness(
            element_count=400,
            player_record_count=400,
            empty_history_count=0,
            season_is_live=True,
        )

    def test_rejects_mixed_empty_and_nonempty_preseason_histories(self):
        from fpl_fetcher import validate_fetch_completeness

        with self.assertRaisesRegex(RuntimeError, "mixed empty histories"):
            validate_fetch_completeness(
                element_count=400,
                player_record_count=1,
                empty_history_count=399,
                season_is_live=False,
            )
