# Feature Specification — Staged Supabase Browser Reader

**Status:** Approved staged rollout under hold-launch posture
**Owner:** Manus AI
**Date:** 2026-08-19

## Outcome

The browser will prefer the public, current Supabase snapshot through `current_fpl_snapshot`, using only the project URL and publishable key. It will validate the returned payload with the existing schema classifier and temporarily fall back to committed `players.json` when the database reader is unavailable, has no published snapshot, or returns an incompatible payload.

## Scope and non-goals

| In scope | Explicitly out of scope |
| --- | --- |
| Supabase-first browser loading from the public current-snapshot view. | Any browser use of a service-role key or any database mutation path. |
| Shared schema classification for Supabase and static datasets. | Removing `players.json` or its workflow commit while the staged observation period is active. |
| Telemetry-visible console warning when static fallback is used. | Enabling public marketing, accounts, SMTP, or custom FDR. |
| Explicit configuration to retain or disable static fallback. | Caching cross-origin Supabase data in the service worker. |

## Load contract

1. When `sourceMode` is `supabase-first`, the loader requests only `current_fpl_snapshot?select=payload&limit=1` with the public publishable key.
2. A one-row response must contain a schema-compatible payload. A valid zero-player preseason snapshot remains valid and must render the existing season-not-started state.
3. Empty responses, HTTP/network failures, malformed envelopes, and incompatible payloads are degraded reader states; if `allowStaticFallback` is enabled, the loader then requests `players.json`.
4. The static fallback result also passes the schema classifier. If both sources fail or are incompatible, the existing explicit load-error state is rendered.
5. The chosen source is recorded in in-memory state. Static fallback emits a concise console warning that identifies its reason without exposing credentials or payload contents.
6. `sourceMode` and `allowStaticFallback` are public non-secret settings in `public_data_config.js`. During observation they are `supabase-first` and `true`; a future cutover can set `allowStaticFallback` to `false` only after documented parity and production checks.

## Security boundary

The client receives only the public Supabase URL and publishable key. It reads only the RLS-protected current-snapshot view and has no function execution, insertion, update, deletion, user-data, or service-role access.

## Verification plan

| Scenario | Expected result |
| --- | --- |
| Valid current Supabase snapshot | Loader selects `supabase`; static fetch is not attempted. |
| Valid zero-player preseason snapshot | Loader selects `supabase`; existing season-not-started UI remains available. |
| Empty, unavailable, malformed, or incompatible Supabase result | Loader selects compatible static fallback and records the fallback reason. |
| Static fallback disabled | Supabase reader failure becomes an explicit load error. |
| Both sources fail | Existing explicit load error is rendered. |
| Deployed staging check | Browser shows `supabase` source with the published schema-v2 snapshot and no secret in loaded source. |
