"""Bootstrap-source guard regressions. Every fetch/session call is mocked."""
import contextlib
import copy
import io
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

import fpl_fetcher


def valid_bootstrap(preseason=False, minutes=90):
    return {
        "teams": [{"id": 1, "short_name": "TST", "code": 1}],
        "events": [
            {"id": 1, "is_current": False, "is_next": preseason,
             "finished": not preseason, "deadline_time": "2026-08-15T10:00:00Z"},
            {"id": 2, "is_current": not preseason, "is_next": False,
             "finished": False, "deadline_time": "2026-08-22T10:00:00Z"},
        ],
        "elements": [{"id": 101, "web_name": "Synthetic", "team": 1,
                      "element_type": 2, "minutes": minutes, "now_cost": 50}],
        "extra_source_metadata": {"ignored": True},
    }


def valid_history():
    return {
        "history": [{"fixture": 21, "round": 1, "opponent_team": 1,
                     "was_home": True, "kickoff_time": "2026-08-15T12:00:00Z",
                     "minutes": 90, "total_points": 5, "goals_scored": 0,
                     "assists": 0, "clean_sheets": 1, "expected_goals": "0.1",
                     "expected_assists": "0.2", "expected_goal_involvements": "0.3"}],
        "fixtures": [],
    }


class BootstrapGuardTests(unittest.TestCase):
    def run_candidate(self, bootstrap, history=None):
        if history is None:
            history = valid_history()
        with patch("fpl_fetcher.requests.Session"), patch(
            "fpl_fetcher.fetch_json", side_effect=[bootstrap, history]
        ) as fetch, patch("fpl_fetcher.time.sleep"), patch(
            "fpl_fetcher.write_json_atomically"
        ) as writer, contextlib.redirect_stdout(io.StringIO()):
            fpl_fetcher.get_fpl_data()
            writer.assert_called_once()
            self.assertEqual(writer.call_args.args[1], "players.json")
            return writer.call_args.args[0], fetch.call_count

    def assert_rejected_before_history_or_write(self, bootstrap):
        with patch("fpl_fetcher.requests.Session"), patch(
            "fpl_fetcher.fetch_json", return_value=bootstrap
        ) as fetch, patch("fpl_fetcher.write_json_atomically") as writer, contextlib.redirect_stdout(io.StringIO()):
            with self.assertRaisesRegex(RuntimeError, "Invalid FPL bootstrap"):
                fpl_fetcher.get_fpl_data()
            self.assertEqual(fetch.call_count, 1, "No element-summary request is allowed after a bad bootstrap")
            writer.assert_not_called()

    def test_all_empty_source_is_not_a_valid_preseason(self):
        self.assert_rejected_before_history_or_write({"teams": [], "events": [], "elements": []})

    def test_source_must_be_an_object(self):
        for payload in (None, [], "unavailable", True):
            with self.subTest(payload_type=type(payload).__name__):
                self.assert_rejected_before_history_or_write(payload)

    def test_required_catalogues_cannot_be_missing_empty_or_non_lists(self):
        for name in ("teams", "events", "elements"):
            for value in (None, [], {}, "unavailable"):
                payload = valid_bootstrap(preseason=True, minutes=0)
                payload[name] = value
                with self.subTest(collection=name, value=value):
                    self.assert_rejected_before_history_or_write(payload)
            payload = valid_bootstrap(preseason=True, minutes=0)
            del payload[name]
            with self.subTest(missing=name):
                self.assert_rejected_before_history_or_write(payload)

    def test_catalogue_rows_must_be_objects(self):
        for name in ("teams", "events", "elements"):
            for row in (None, [], "invalid"):
                payload = valid_bootstrap(preseason=True, minutes=0)
                payload[name][0] = row
                with self.subTest(collection=name, row=row):
                    self.assert_rejected_before_history_or_write(payload)

    def test_ids_must_be_unique_positive_integers_not_booleans(self):
        for name in ("teams", "events", "elements"):
            for value in (None, 0, -1, True, "1", 1.5):
                payload = valid_bootstrap(preseason=True, minutes=0)
                payload[name][0]["id"] = value
                with self.subTest(collection=name, id=value):
                    self.assert_rejected_before_history_or_write(payload)
            payload = valid_bootstrap(preseason=True, minutes=0)
            payload[name].append(copy.deepcopy(payload[name][0]))
            with self.subTest(duplicate=name):
                self.assert_rejected_before_history_or_write(payload)

    def test_team_display_identity_cannot_be_missing_or_invalid(self):
        for field, values in (("short_name", (None, "", " ", 3)), ("code", (None, 0, -1, True, "1"))):
            for value in values:
                payload = valid_bootstrap(preseason=True, minutes=0)
                payload["teams"][0][field] = value
                with self.subTest(field=field, value=value):
                    self.assert_rejected_before_history_or_write(payload)

    def test_players_must_reference_a_known_integer_team(self):
        for value in (None, 0, True, "1", 999):
            payload = valid_bootstrap(preseason=True, minutes=0)
            payload["elements"][0]["team"] = value
            with self.subTest(team=value):
                self.assert_rejected_before_history_or_write(payload)

    def test_eligibility_minutes_cannot_be_missing_negative_or_wrong_type(self):
        for value in (None, -1, True, "0", 0.5, float("nan"), float("inf")):
            payload = valid_bootstrap(preseason=True, minutes=0)
            payload["elements"][0]["minutes"] = value
            with self.subTest(minutes=value):
                self.assert_rejected_before_history_or_write(payload)
        payload = valid_bootstrap(preseason=True, minutes=0)
        del payload["elements"][0]["minutes"]
        self.assert_rejected_before_history_or_write(payload)

    def test_consumed_event_flags_are_required_real_booleans(self):
        for flag in ("is_current", "is_next", "finished"):
            for value in (None, 0, "false", []):
                payload = valid_bootstrap(preseason=True, minutes=0)
                payload["events"][0][flag] = value
                with self.subTest(flag=flag, value=value):
                    self.assert_rejected_before_history_or_write(payload)
            payload = valid_bootstrap(preseason=True, minutes=0)
            del payload["events"][0][flag]
            with self.subTest(missing_flag=flag):
                self.assert_rejected_before_history_or_write(payload)

    def test_event_deadlines_must_be_timezone_aware_iso_timestamps(self):
        for value in (None, "", "not-a-time", "2026-08-15", "2026-08-15T10:00:00", 17):
            payload = valid_bootstrap(preseason=True, minutes=0)
            payload["events"][0]["deadline_time"] = value
            with self.subTest(deadline=value):
                self.assert_rejected_before_history_or_write(payload)

    def test_duplicate_current_or_next_markers_are_ambiguous(self):
        payload = valid_bootstrap()
        payload["events"][0]["is_current"] = True
        self.assert_rejected_before_history_or_write(payload)
        payload = valid_bootstrap(preseason=True, minutes=0)
        payload["events"][1]["is_next"] = True
        self.assert_rejected_before_history_or_write(payload)

    def test_an_event_cannot_be_both_current_and_next_or_next_and_finished(self):
        for flag in ("is_current", "finished"):
            payload = valid_bootstrap(preseason=True, minutes=0)
            payload["events"][0][flag] = True
            with self.subTest(inconsistent_flag=flag):
                self.assert_rejected_before_history_or_write(payload)

    def test_preseason_requires_explicit_first_next_event(self):
        payload = valid_bootstrap(preseason=True, minutes=0)
        payload["events"][0]["is_next"] = False
        self.assert_rejected_before_history_or_write(payload)
        payload["events"][1]["is_next"] = True
        self.assert_rejected_before_history_or_write(payload)

    def test_valid_zero_eligible_preseason_keeps_empty_output_and_source_unchanged(self):
        payload = valid_bootstrap(preseason=True, minutes=0)
        before = copy.deepcopy(payload)
        result, fetch_count = self.run_candidate(payload)
        self.assertEqual(result["players"], [])
        self.assertEqual(result["schema_version"], 2)
        self.assertEqual(result["current_gw"], 1)
        self.assertEqual(result["deadline"], payload["events"][0]["deadline_time"])
        self.assertEqual(fetch_count, 1)
        self.assertEqual(payload, before)

    def test_existing_all_empty_eligible_history_preseason_is_preserved(self):
        result, fetch_count = self.run_candidate(
            valid_bootstrap(preseason=True), {"history": [], "fixtures": []}
        )
        self.assertEqual(result["players"], [])
        self.assertEqual(fetch_count, 2)

    def test_valid_live_season_keeps_statistics_and_zero_minute_catalogue_rows(self):
        payload = valid_bootstrap()
        unused = copy.deepcopy(payload["elements"][0])
        unused.update({"id": 102, "minutes": 0})
        payload["elements"].append(unused)
        before = copy.deepcopy(payload)
        result, fetch_count = self.run_candidate(payload)
        self.assertEqual(fetch_count, 2)
        self.assertEqual([p["element_id"] for p in result["players"]], [101])
        self.assertEqual(result["current_gw"], 2)
        self.assertEqual(result["players"][0]["last_5_points"], 5)
        self.assertEqual(result["players"][0]["last_5_min_pct"], 100)
        self.assertEqual(payload, before)

    def test_current_event_may_already_be_finished(self):
        payload = valid_bootstrap()
        payload["events"][1]["finished"] = True
        result, _ = self.run_candidate(payload)
        self.assertEqual(result["current_gw"], 2)
        self.assertEqual(len(result["players"]), 1)

    def test_finished_season_without_current_or_next_keeps_existing_behavior(self):
        payload = valid_bootstrap()
        for event in payload["events"]:
            event.update({"is_current": False, "is_next": False, "finished": True})
        result, _ = self.run_candidate(payload)
        self.assertEqual(len(result["players"]), 1)
        self.assertIsNone(result["deadline"])

    def test_valid_offset_deadline_and_extra_fields_are_not_rewritten(self):
        payload = valid_bootstrap(preseason=True, minutes=0)
        payload["events"][0]["deadline_time"] = "2026-08-15T13:00:00+03:00"
        result, _ = self.run_candidate(payload)
        self.assertEqual(result["deadline"], "2026-08-15T13:00:00+03:00")

    def test_live_zero_eligibility_still_fails_completeness_guard(self):
        with self.assertRaisesRegex(RuntimeError, "zero eligible players"):
            self.run_candidate(valid_bootstrap(minutes=0))

    def test_broken_starting_response_preserves_last_good_file_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            target = Path(folder) / "players.json"
            previous = b'{"known_good_synthetic_snapshot":true}\n'
            target.write_bytes(previous)
            atomic_writer = fpl_fetcher.write_json_atomically
            with patch("fpl_fetcher.requests.Session"), patch(
                "fpl_fetcher.fetch_json", return_value={"teams": [], "events": [], "elements": []}
            ), patch("fpl_fetcher.write_json_atomically", side_effect=lambda candidate, _path: atomic_writer(candidate, target)), contextlib.redirect_stdout(io.StringIO()):
                with self.assertRaisesRegex(RuntimeError, "Invalid FPL bootstrap"):
                    fpl_fetcher.get_fpl_data()
            self.assertEqual(target.read_bytes(), previous)
            self.assertFalse(target.with_suffix(".json.tmp").exists())


if __name__ == "__main__":
    unittest.main()
