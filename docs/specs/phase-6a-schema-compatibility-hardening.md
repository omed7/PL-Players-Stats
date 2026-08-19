# Feature Specification — Schema Compatibility Hardening

**Status:** Approved for implementation
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

FPL Omed must consume only known `players.json` contracts. A current legacy schema-v1 snapshot remains usable through the existing `gw_history` path, and schema-v2 snapshots may use `match_history`. A missing, non-integer, or unsupported schema version must never be interpreted optimistically; it must render the existing retryable unavailable-data state.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| A pure browser-compatible schema classifier for legacy v1, v2, and incompatible snapshots. | A new dataset schema version or a fetcher contract change. |
| Focused unit tests for missing, malformed, supported, and future schema versions. | Authentication, Supabase configuration, account UI, or Custom FDR. |
| Loader integration that clears stale data and reports incompatible snapshots safely. | Reworking player history, filters, styling, or local-storage identity. |

## 3. Decisions

| Topic | Decision | Open? |
|---|---|---|
| Supported schemas | Only integer schema versions **1** and **2** are supported. | No |
| Legacy array payload | A root array is classified as legacy schema **1** for backward compatibility. | No |
| Missing version on object payload | Incompatible. Object payloads must declare their version explicitly. | No |
| Future/unknown version | Incompatible; show a retryable unavailable-data state rather than guessing fields. | No |
| Schema-v1 history | Player detail continues to use legacy `gw_history`. | No |
| Schema-v2 history | Player detail uses `match_history` through the existing history utility. | No |

## 4. User journey and behavior

1. The browser fetches `players.json`.
2. If the payload is a legacy root array, it loads as schema v1.
3. If the object declares integer schema 1 or 2, it loads through that supported path.
4. If the object omits a schema version, declares a non-integer version, or declares any unsupported version, the browser clears the active player dataset and shows: **“Player data format is temporarily incompatible. Please try again shortly.”**
5. A subsequent valid retry restores normal preseason, no-results, or populated-player behavior.

## 5. Data contract and invariants

| Field/entity | Required rule | Failure/degraded behavior |
|---|---|---|
| Root array | Explicit legacy compatibility path; interpreted as schema 1. | No metadata/history-v2 assumptions. |
| `schema_version` on object payload | Must be an integer in `{1, 2}`. | Reject all other values. |
| Schema v1 | Use only legacy-compatible fields such as `gw_history`. | Do not access `match_history` as a contract requirement. |
| Schema v2 | May use validated `match_history` in existing detail consumers. | Missing player history renders no history, not invented matches. |
| Incompatible snapshot | Never render prior player data or claim a valid preseason state. | Clear state and show the retryable unavailable-data alert. |

The existing fixture truthfulness and preseason rules are unchanged. A valid schema-v2 zero-player preseason snapshot remains a season-not-started state, not an incompatibility error.

## 6. Technical design

| Component | Change | Test seam |
|---|---|---|
| `schema_utils.js` | Add pure `classifyPlayerDataset(payload)` that returns either a supported version/payload shape or a safe incompatibility result. | Jest unit tests. |
| `script.js` | Use the classifier in `fetchPlayers`; reset active data before displaying an incompatible-snapshot error. | Browser check with synthetic incompatible payload. |
| `index.html` | Load the pure schema utility before the main controller. | Static load order review. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method |
|---|---|---|
| AC-1 | Legacy root arrays remain schema-v1 compatible. | Jest test. |
| AC-2 | Object snapshots with integer versions 1 and 2 are accepted. | Jest test. |
| AC-3 | Missing, fractional, string, `null`, and future versions are rejected. | Jest test. |
| AC-4 | An incompatible snapshot clears current data and exposes the retryable unavailable-data alert; it does not render a preseason state. | Browser check. |
| AC-5 | A valid schema-v2 zero-player snapshot still shows the normal preseason state. | Existing plus browser regression check. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Root array | Implicit v1 path. | Explicit accepted v1 classification. | Jest |
| Object schema 1 / 2 | Accepted through broad truthy fallback. | Explicitly accepted only when integer and supported. | Jest |
| Missing/unknown schema | Treated as v1 or v2 by fallback/threshold behavior. | Classified incompatible. | Jest |
| Incompatible payload after valid state | Could retain metadata/state while reporting an error. | Active data/metadata cleared and retryable alert shown. | Browser |
| Valid v2 preseason snapshot | Current season-not-started behavior. | Remains unchanged. | Jest/browser |

## 9. Release and rollback

This is a static frontend release with no migration, secret, account, or fetcher change. The rollback is a source rollback to the current v1/v2 permissive loader. The deployed browser must be refreshed so the new script is fetched; the existing service-worker cache version is sufficient because modified same-origin scripts are cache-busted by the browser deployment URL/versioning behavior.

## 10. Completion record

| Check | Result |
|---|---|
| Focused tests pass | Pending |
| Browser incompatible-schema verification complete | Pending |
| Valid v2 preseason regression complete | Pending |
| Production deployment ready | Pending |

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-08-19 | Support only schemas 1 and 2. | Future contracts must be implemented deliberately rather than inferred from field names. |
| 2026-08-19 | Require explicit versioning for object snapshots. | A missing version is ambiguous and must not be silently mapped to legacy behavior. |
