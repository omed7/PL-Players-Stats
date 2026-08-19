# Feature Specification — Fetch Integrity Hardening

**Status:** Approved for implementation
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

The scheduled FPL fetch must never write a reduced `players.json` when a player who is eligible for the public explorer has a failed or schema-invalid history response. The workflow must fail before its atomic write, preserving the last known good snapshot. Before the season is live, the FPL source may return an all-empty element-summary history set even when bootstrap values make elements nominally eligible; that exact all-empty condition remains a valid zero-player preseason snapshot.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Replace the permissive partial-output threshold with exact processed-player completeness. | Fetching history for every FPL element, including players with no recorded season minutes. |
| Make in-season or mixed-preseason empty summary history, plus every player record/fixture validation failure, fatal for processed players. | Changing table eligibility, player-detail presentation, or venue controls. |
| Test live-season zero eligibility, empty history, and partial record output. | Account, SMTP, Supabase, Custom FDR, or local-storage identity work. |
| Preserve zero-minute completed history rows for players who are otherwise eligible. | Claiming that a player with no recorded season minutes has public history data. |

## 3. Decisions

| Topic | Decision | Open? |
|---|---|---|
| Public player eligibility | Retain the established bootstrap rule: process only elements with `minutes > 0`. | No |
| Preseason zero-player output | Valid when the season is not live and either zero elements are eligible or every eligible element summary history is empty. | No |
| Active-season zero eligibility | Fatal pipeline error. | No |
| Processed-player summary response | Every eligible player requires one successful list response. During a live season it must be non-empty; before live, it is valid only when all eligible histories are empty. | No |
| Processed-player validation error | Any invalid history, fixture, identity, or numeric conversion error aborts the run. | No |
| Record completeness | The output count must equal the count of eligible elements; no percentage threshold. | No |
| Zero-minute history row | Retain it when it belongs to an eligible player, even though it is not an appearance. | No |

## 4. User and operational behavior

1. Before the first live gameweek, the FPL source may return empty summary histories for every otherwise eligible element. The fetch succeeds with a zero-player schema-v2 snapshot and the browser presents season-not-started.
2. During a live season, the fetch obtains a non-empty summary history response for every eligible player and transforms every record.
3. If a response fails, is malformed, is empty during a live season, is mixed with non-empty histories before live, or has an invalid record, the process exits unsuccessfully before writing `players.json`.
4. The workflow remains red and the repository retains the last valid committed snapshot.
5. When all eligible responses and transformations succeed, the output contains exactly one record per eligible player and is atomically written.

## 5. Data contract and invariants

| Entity | Required rule | Failure behavior |
|---|---|---|
| Eligible element | `bootstrap-static.elements[].minutes > 0`. | A zero-element dataset is valid only before the season is live. |
| Element summary history | List response for every eligible element. It is non-empty during a live season; before live, either all are empty or all are transformable. | Abort before output write on a non-list, in-season empty, or mixed-preseason set. |
| Match history record | Must include valid fixture ID, opponent team ID, venue flag, and safe numeric conversions. | Abort before output write. |
| Player record | One transformed output record per eligible element. | Abort before output write. |
| Existing `players.json` | Atomic-write target only after all validation passes. | Preserve the prior valid file on any failure. |
| Zero-minute row | Preserve in `match_history` for an otherwise eligible player. | Do not reinterpret it as an appearance. |

Fixture truthfulness is unchanged. Missing upcoming fixture data remains unknown/TBC and is not converted into an explicit blank gameweek.

## 6. Technical design

| Component | Change | Test seam |
|---|---|---|
| `validate_fetch_completeness` | Reject active-season zero eligibility, in-season or mixed-preseason empty histories, and any incomplete transformed output. | Python unit tests. |
| `get_fpl_data` | Remove broad per-player exception swallowing. Raise a contextual fatal error for malformed, in-season empty, mixed-preseason, or transformation-invalid histories. | Fetcher control-flow review and tests of validation helpers. |
| `tests/python/test_fpl_fetcher.py` | Replace percentage-threshold assumptions with exact integrity-policy scenarios. | Python unittest. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method |
|---|---|---|
| AC-1 | A pre-live zero-eligible dataset remains accepted. | Python unit test. |
| AC-2 | A live-season zero-eligible dataset is rejected. | Python unit test. |
| AC-3 | An empty eligible-player history is rejected during a live season or when mixed with non-empty histories before live; an all-empty preseason set remains accepted. | Python unit tests. |
| AC-4 | Any missing transformed player record is rejected, even when the former 90% threshold would have passed. | Python unit test. |
| AC-5 | Player transformation failures abort the fetch rather than being logged and skipped. | Source control-flow review and regression test coverage. |
| AC-6 | The complete JavaScript and Python suite passes, and the PR CI check succeeds before merge. | `npm test` and GitHub Actions. |

## 8. Release and rollback

The change does not alter production secrets, database state, browser API configuration, or schema version. It can cause the scheduled workflow to fail more often when the upstream source is malformed; this is intentional observability, not a service regression. Rollback is a source revert; an atomic-write failure never replaces the prior valid snapshot.

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-19 | Retain `minutes > 0` as public explorer eligibility. | It is the existing documented preseason rule and keeps the public output focused on players with recorded season participation. |
| 2026-08-19 | Remove percentage-based partial success for eligible players. | A successful-looking but incomplete player set is less truthful than a visibly failed data refresh. |
