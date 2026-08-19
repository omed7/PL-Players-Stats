# Feature Specification — Supabase-First Public FPL Data

**Status:** Architecture approved; production cutover pending secure ingestion configuration
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

FPL Omed will move from GitHub-committed `players.json` snapshots to Supabase Postgres as the authoritative store for public player, fixture, match-history, and refresh-metadata data. The browser will eventually read a published, schema-versioned snapshot from Supabase using the existing public URL and publishable key, while all upstream FPL ingestion remains server-side.

The current static snapshot remains the last known good production source until the database schema, data ingestion, public-read policy, browser consumer, and rollback behavior have been verified in parallel. This prevents an unfinished migration from making valid preseason data unavailable.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add a public FPL catalog/snapshot schema alongside the existing account tables. | Exposing any service-role or secret key to the browser, repository, or Vercel environment. |
| Define public read policies and server-only mutation boundaries. | Enabling email sign-in before production SMTP is configured. |
| Define a secure scheduled ingestion route and an overlap/rollback migration sequence. | Replacing valid production data with an unverified database source. |
| Update the frontend consumer only after a database snapshot is verifiably available. | Custom FDR calculations or any user-owned data write path. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Public-data authority | Supabase Postgres becomes the durable source of truth for FPL data. | User instruction, 2026-08-19. | No |
| Existing account tables | `profiles`, `user_preferences`, and `watchlist_items` remain owner-only RLS tables. | Live project schema, `ghowrpjnoraohyjpmvuo`. | No |
| Browser credentials | Browser code may use only the Supabase URL and active publishable key. | Existing project configuration and security requirement. | No |
| Ingestion credentials | Privileged writes must execute inside a server-side boundary using a Supabase secret key or internal service role. | Supabase key guidance. | No |
| Scheduled ingestion trigger | The production scheduler/secret delivery mechanism is not selected yet. | Requires a secure route and operational decision. | Yes |
| Source fallback | `players.json` remains the production fallback until the database snapshot passes parallel verification. | Last-known-good data invariant. | No |

## 4. User and operational behavior

1. The scheduled server-side ingestion process fetches FPL bootstrap and element-summary responses, applies the existing completeness rules, and writes one complete snapshot atomically to Supabase.
2. Public visitors load the latest complete published snapshot through a read-only database view or RPC. They continue to see the explicit season-not-started state for a valid zero-player preseason snapshot.
3. A failed fetch, malformed player record, incomplete eligible-player set, or failed database publication leaves the prior published snapshot active.
4. While the browser is migrated, it can fall back to the committed `players.json` snapshot only when the database is unavailable or lacks a valid published snapshot. The fallback is telemetry-visible and temporary.
5. Once database publication and browser consumption have demonstrated stability, scheduled commits of `players.json` are retired; the workflow still tests fetcher transformations but no longer writes public data into Git history.

## 5. Data contract and invariants

| Entity | Source | Required rule | Failure/degraded behavior |
|---|---|---|---|
| `fpl_sync_runs` | Server-side ingestion | One run records lifecycle, source freshness, schema version, eligibility counts, and error state. | Failed runs never become current. |
| `fpl_published_snapshots` | Validated ingestion output | Exactly one current complete snapshot is publicly selectable; payload includes `schema_version`, fetch metadata, players, fixtures, and full match history. | Prior current snapshot remains active. |
| Public read API | Supabase view/RPC | Anonymous users can read only the current snapshot; no write or account-table access. | Browser uses temporary static fallback during migration. |
| Account tables | Authenticated users | Existing `user_id = auth.uid()` ownership policies remain unchanged. | No public access. |
| Player identity | FPL `element_id` | Stable positive FPL element ID is the player key in every public and user-owned reference. | Reject malformed source data. |
| Fixture status | FPL source | Missing/unassigned fixture data remains unknown/TBC; absence never proves BGW. | Preserve unknown state. |
| Preseason snapshot | Validated FPL data | A zero-player snapshot remains valid only under the existing legitimate preseason completeness policy. | Show season-not-started, not load error. |

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| Supabase migration | Add append-only run metadata and versioned public snapshot tables with public-read-only policies. | Keep public FPL data separate from owner-only preferences. | Migration inspection, RLS policy query, public-read query. |
| Server-side sync | Move FPL fetch, transformation, validation, and publication into a server-only function or worker. | Keep privileged database writes and source-fetch mechanics out of clients. | Fetcher/unit tests, scheduled integration test, failed-run retention test. |
| Publication transaction | Insert complete snapshot then make it current in one transaction/RPC. | Preserve last known good public data. | Database integration test. |
| Browser loader | Prefer the current Supabase snapshot; retain `players.json` fallback only during cutover. | Permit staged migration and rollback. | Loader unit tests and browser tests for database, fallback, error, preseason, and incompatible-schema states. |
| GitHub workflow | Stop committing public snapshot data only after the database path is live; retain validation tests. | Remove source-data history churn while retaining regression protection. | Workflow run and no-change behavior. |

## 7. Secure ingestion options requiring an explicit operational choice

| Approach | Trade-offs | Cost | Setup complexity |
|---|---|---|---|
| A managed database function invoked by an internal database schedule | Keeps secrets and privileged writes inside Supabase; requires a secure scheduler-to-function authentication design and validation of available extensions. | Uses the existing Supabase project; any plan-specific execution limits must be checked before enabling. | Medium |
| A GitHub Actions scheduled job writing through a Supabase secret key | Reuses the existing scheduler and Python fetcher; requires a dedicated secret stored in GitHub Actions and server-only use. | Uses existing GitHub Actions allowance and Supabase project. | Low to medium |
| A small managed backend with its own scheduled job | Gives a full server runtime and operator controls; adds hosting and deployment surface. | Depends on provider and schedule frequency. | Medium to high |

The approved direction is the Supabase data authority, not yet a selection among these secret-bearing scheduled ingestion mechanisms. No implementation may assume a secret value or place it in browser code, Vercel configuration, or repository files.

## 8. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Public FPL tables/views are separate from owner-only account tables and have explicit RLS/public-read policy. | Live schema and policy inventory. | Pending. |
| AC-2 | A successful server-side ingestion publishes a schema-v2 snapshot that matches the approved player contract. | Integration test and direct public read. | Pending. |
| AC-3 | Any failed or incomplete ingestion leaves the prior public snapshot current. | Transaction/failure-path test. | Pending. |
| AC-4 | The browser loads the public database snapshot without a secret and preserves explicit preseason/error/fallback states. | Browser and loader tests. | Pending. |
| AC-5 | A temporary static fallback can be disabled by a documented feature flag or cutover step. | Browser test and deployment check. | Pending. |
| AC-6 | Public data no longer requires scheduled Git commits after cutover. | Workflow inspection and production run. | Pending. |

## 9. Release and rollback

The migration uses overlap, not replacement. The initial database schema and reader are deployed without changing the public data source. The browser consumer is enabled only after a successful database snapshot exists and passes parity checks against the static snapshot. The prior `players.json` loader remains available during the observation period. Rollback is a frontend switch back to the static snapshot and does not delete database history.

## 10. Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-19 | Supabase is the intended authoritative public FPL database. | User requested a database rather than repository JSON files. | Existing static pipeline becomes a temporary migration fallback. |
| 2026-08-19 | Do not choose or create a privileged ingestion credential unattended. | Secret storage and scheduling are security/operational decisions; credentials must remain server-side. | Full automatic cutover is deferred until a secure ingestion route is selected. |
