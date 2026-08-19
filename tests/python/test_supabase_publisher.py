import unittest
from unittest.mock import Mock

from supabase_publisher import publish_snapshot, snapshot_hash, validate_snapshot


VALID_SNAPSHOT = {
    "schema_version": 2,
    "fetched_at": "2026-08-19T19:50:00Z",
    "next_gws": [1, 2, 3, 4, 5],
    "current_gw": 1,
    "deadline": "2026-08-21T17:30:00Z",
    "players": [],
}


class SnapshotValidationTests(unittest.TestCase):
    def test_accepts_a_schema_v2_preseason_snapshot(self):
        self.assertIs(validate_snapshot(VALID_SNAPSHOT), VALID_SNAPSHOT)

    def test_rejects_unsupported_schema_before_publication(self):
        snapshot = {**VALID_SNAPSHOT, "schema_version": 1}
        with self.assertRaisesRegex(RuntimeError, "schema_version 2"):
            validate_snapshot(snapshot)

    def test_rejects_missing_players_array_before_publication(self):
        snapshot = {**VALID_SNAPSHOT, "players": {}}
        with self.assertRaisesRegex(RuntimeError, "players array"):
            validate_snapshot(snapshot)

    def test_rejects_invalid_fetch_timestamp_before_publication(self):
        snapshot = {**VALID_SNAPSHOT, "fetched_at": "not-a-timestamp"}
        with self.assertRaisesRegex(RuntimeError, "invalid fetched_at"):
            validate_snapshot(snapshot)

    def test_hash_is_deterministic_for_equivalent_json_objects(self):
        reordered = {
            "players": [],
            "deadline": "2026-08-21T17:30:00Z",
            "current_gw": 1,
            "next_gws": [1, 2, 3, 4, 5],
            "fetched_at": "2026-08-19T19:50:00Z",
            "schema_version": 2,
        }
        self.assertEqual(snapshot_hash(VALID_SNAPSHOT), snapshot_hash(reordered))

    def test_hash_ignores_a_changed_fetch_timestamp_for_unchanged_content(self):
        later_fetch = {**VALID_SNAPSHOT, "fetched_at": "2026-08-20T03:00:00Z"}
        self.assertEqual(snapshot_hash(VALID_SNAPSHOT), snapshot_hash(later_fetch))

    def test_hash_changes_when_player_content_changes(self):
        changed_players = {**VALID_SNAPSHOT, "players": [{"element_id": 101}]}
        self.assertNotEqual(snapshot_hash(VALID_SNAPSHOT), snapshot_hash(changed_players))


class SnapshotPublicationTests(unittest.TestCase):
    def test_requires_service_role_key_before_http_publication(self):
        session = Mock()
        with self.assertRaisesRegex(RuntimeError, "SUPABASE_SERVICE_ROLE_KEY"):
            publish_snapshot(VALID_SNAPSHOT, "", session=session)
        session.post.assert_not_called()

    def test_posts_only_to_the_server_side_rpc_with_expected_payload(self):
        response = Mock()
        response.json.return_value = {"published": True, "snapshot_version": 7}
        session = Mock()
        session.post.return_value = response

        result = publish_snapshot(
            VALID_SNAPSHOT,
            "test-service-key",
            supabase_url="https://example.supabase.co",
            session=session,
        )

        self.assertEqual(result, {"published": True, "snapshot_version": 7})
        url, = session.post.call_args.args
        self.assertEqual(url, "https://example.supabase.co/rest/v1/rpc/publish_fpl_snapshot")
        kwargs = session.post.call_args.kwargs
        self.assertEqual(kwargs["headers"]["apikey"], "test-service-key")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-service-key")
        self.assertEqual(kwargs["json"]["p_player_count"], 0)
        self.assertEqual(kwargs["json"]["p_payload"], VALID_SNAPSHOT)
        self.assertEqual(kwargs["json"]["p_payload_hash"], snapshot_hash(VALID_SNAPSHOT))

    def test_returns_unchanged_result_without_treating_it_as_a_failure(self):
        response = Mock()
        response.json.return_value = {"published": False, "snapshot_version": 7}
        session = Mock()
        session.post.return_value = response

        result = publish_snapshot(VALID_SNAPSHOT, "test-service-key", session=session)

        self.assertFalse(result["published"])
        self.assertEqual(result["snapshot_version"], 7)

    def test_raises_when_the_rpc_response_is_unsuccessful(self):
        response = Mock()
        response.raise_for_status.side_effect = Exception("401 Unauthorized")
        session = Mock()
        session.post.return_value = response

        with self.assertRaisesRegex(RuntimeError, "Supabase snapshot publication failed"):
            publish_snapshot(VALID_SNAPSHOT, "test-service-key", session=session)

    def test_rejects_an_invalid_rpc_response(self):
        response = Mock()
        response.json.return_value = []
        session = Mock()
        session.post.return_value = response

        with self.assertRaisesRegex(RuntimeError, "invalid response"):
            publish_snapshot(VALID_SNAPSHOT, "test-service-key", session=session)


if __name__ == "__main__":
    unittest.main()
