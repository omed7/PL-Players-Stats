"""Publish a validated FPL snapshot through the server-side Supabase RPC.

The service-role key is read only at runtime from the environment. It must never
be stored in repository files, browser code, or Vercel configuration.
"""

import hashlib
import json
import os
from datetime import datetime
from pathlib import Path

import requests

DEFAULT_SUPABASE_URL = "https://ghowrpjnoraohyjpmvuo.supabase.co"
RPC_NAME = "publish_fpl_snapshot"


def validate_snapshot(snapshot):
    """Validate the minimum completed schema-v2 contract before publication."""
    if not isinstance(snapshot, dict):
        raise RuntimeError("Snapshot payload must be an object")
    if snapshot.get("schema_version") != 2:
        raise RuntimeError("Snapshot payload must use schema_version 2")
    if not isinstance(snapshot.get("players"), list):
        raise RuntimeError("Snapshot payload must include a players array")

    fetched_at = snapshot.get("fetched_at")
    if not isinstance(fetched_at, str):
        raise RuntimeError("Snapshot payload must include a fetched_at timestamp")
    try:
        datetime.fromisoformat(fetched_at.replace("Z", "+00:00"))
    except ValueError as error:
        raise RuntimeError("Snapshot payload has an invalid fetched_at timestamp") from error

    return snapshot


def snapshot_hash(snapshot):
    """Return a stable hash of FPL content, excluding volatile fetch metadata."""
    content_payload = {key: value for key, value in snapshot.items() if key != "fetched_at"}
    canonical_payload = json.dumps(
        content_payload, sort_keys=True, separators=(",", ":"), ensure_ascii=True
    )
    return hashlib.sha256(canonical_payload.encode("utf-8")).hexdigest()


def publish_snapshot(snapshot, service_role_key, supabase_url=DEFAULT_SUPABASE_URL, session=None):
    """Publish one validated snapshot through the atomically safe database RPC."""
    validate_snapshot(snapshot)
    if not isinstance(service_role_key, str) or not service_role_key.strip():
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is required for publication")
    if not isinstance(supabase_url, str) or not supabase_url.startswith("https://"):
        raise RuntimeError("SUPABASE_URL must be an HTTPS URL")

    request_session = session or requests.Session()
    response = request_session.post(
        f"{supabase_url.rstrip('/')}/rest/v1/rpc/{RPC_NAME}",
        headers={
            "apikey": service_role_key,
            "Authorization": f"Bearer {service_role_key}",
            "Content-Type": "application/json",
        },
        json={
            "p_payload": snapshot,
            "p_payload_hash": snapshot_hash(snapshot),
            "p_fetched_at": snapshot["fetched_at"],
            "p_player_count": len(snapshot["players"]),
            "p_source_metadata": {
                "publisher": "github-actions",
                "source": "fpl_fetcher.py",
            },
        },
        timeout=30,
    )
    try:
        response.raise_for_status()
    except Exception as error:
        raise RuntimeError(f"Supabase snapshot publication failed: {error}") from error

    result = response.json()
    if not isinstance(result, dict) or "published" not in result:
        raise RuntimeError("Supabase snapshot publication returned an invalid response")
    return result


def publish_snapshot_file(snapshot_path="players.json"):
    """Load a completed local snapshot and publish it using runtime environment values."""
    snapshot = json.loads(Path(snapshot_path).read_text(encoding="utf-8"))
    result = publish_snapshot(
        snapshot=snapshot,
        service_role_key=os.environ.get("SUPABASE_SERVICE_ROLE_KEY", ""),
        supabase_url=os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL),
    )
    status = "published" if result["published"] else "unchanged"
    print(f"Supabase snapshot {status}; version={result.get('snapshot_version')}")
    return result


if __name__ == "__main__":
    publish_snapshot_file(os.environ.get("PLAYERS_JSON_PATH", "players.json"))
