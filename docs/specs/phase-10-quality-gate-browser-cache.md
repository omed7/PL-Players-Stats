# Phase 10 — Browser Quality Gate and Cache Upgrade Safety

**Status:** Approved  
**Owner:** omed7  
**Date:** 24 August 2026  
**Related issue / PR:** N/A

## 1. Outcome

This slice reduces pre-launch regression risk at two boundaries identified in the project review: browser data-state preparation and returning-user application delivery. The application must derive its loaded dashboard state through a pure, tested helper, and a browser with a prior app-shell cache must request a fresh application shell after a service-worker update. The slice preserves all approved FPL data semantics, privacy boundaries, UI layout, and account behavior.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Extract the pure data-to-dashboard-state preparation logic currently embedded in the browser controller. | A framework migration, broad controller rewrite, or complete end-to-end test framework adoption. |
| Add regression tests for populated, valid preseason, and incompatible data states. | Changes to player, fixture, FDR, account-sync, Supabase, or Team ID data contracts. |
| Make service-worker app-shell delivery network-first and clear prior caches during activation. | Offline app-shell support, precaching, background sync, or a database migration. |
| Add focused source-level regression tests for service-worker behavior. | The separate safe-DOM-rendering and publication-concurrency hardening items. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Data source | The existing Supabase-first reader and optional static fallback remain unchanged. | Approved project architecture. | No |
| Product behaviour | A compatible non-empty dataset remains `ready`; a valid zero-player preseason dataset remains `preseason`; incompatible input remains a load failure. | Existing dashboard-state and preseason invariants. | No |
| Security / privacy | No auth, public Team ID, RLS, key, or credential behavior changes. | Approved project architecture. | No |
| Compatibility | The new browser helper uses the project’s existing UMD module pattern and loads before `script.js`. | Existing utility-module convention. | No |
| Cache behavior | Same-origin app-shell resources are network-first; a network failure may use a cached response as resilience fallback. `players.json` remains network-first. | Quality-gate decision for returning-user upgrade safety. | No |

## 4. User journey and behaviour

1. A visitor opens the dashboard and receives a compatible dataset from the existing reader.
2. The application derives validated players, metadata, price bounds, and the expected dashboard state through the pure helper before rendering filters and rows.
3. A valid zero-player snapshot with gameweek 1 and a future deadline renders the existing explicit season-not-started state; it is not presented as a filter result or load failure.
4. A returning visitor whose service worker has a previously cached application shell requests the current shell from the network. If the network is unavailable, the most recent cached shell remains available as a resilience fallback.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure / degraded behavior |
|---|---|---|---|
| Compatible player dataset | Existing public-data reader plus schema classifier | Must contain a `players` array before dashboard state is prepared. | Throw a controlled error for the existing load-error path. |
| `current_gw` and `deadline` | Existing public snapshot | A zero-player snapshot is preseason only when `current_gw` is 1 and the deadline is valid and in the future. | Other zero-player states remain `no_results` unless a load error applies. |
| Price range | Player records | Bounds retain the existing £3.0m–£15.0m baseline and extend only when a valid player price exceeds it. | The UI does not receive `Infinity` or `-Infinity`. |
| `players.json` | Existing same-origin static fallback | Retains network-first fetch and cached fallback behavior. | Existing static fallback remains available when network fetch fails. |
| App-shell resources | Same-origin GET requests other than `players.json` | Must try the current network response before cached content. | Cached content is used only after a network failure. |

The change does not alter the rule that a missing fixture is not a blank gameweek. It does not alter valid preseason handling, FPL element-ID persistence, or any credential and RLS boundary.

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `dashboard_data_utils.js` | Add a UMD helper that validates the classified reader result, normalizes dashboard metadata, derives finite price bounds, and classifies `ready`, `preseason`, `no_results`, or `error`. | Moves the data-to-dashboard handoff out of the 2,250-line controller into a pure seam. | Jest unit tests with compatible, preseason, incompatible, and malformed-price inputs. |
| `script.js` | Consume the helper in `fetchPlayers` and retain the current rendering, error, filter, and countdown behavior. | Ensures production execution uses the tested seam. | Existing suite plus browser verification. |
| `index.html` | Load `dashboard_data_utils.js` after `ui_state_utils.js` and before `script.js`. | Makes the module available before controller initialization. | Metadata test verifying script ordering. |
| `sw.js` | Use one shared network-first helper for same-origin GET requests, cache successful network responses, and fall back to cache only on fetch failure. | Prevents an unchanged cache name from overriding a newly deployed app shell for returning visitors. | Source-level service-worker behavior tests plus manual browser check. |
| `tests/` | Add unit tests for the new helper and service-worker regression assertions. | Keeps the slice enforced in CI. | `npm test`. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Compatible populated data produces validated player state, finite price bounds, and `ready`. | Unit test. | `tests/dashboard_data_utils.test.js` |
| AC-2 | A valid zero-player gameweek-1 snapshot with a future deadline produces `preseason`, not `no_results` or `error`. | Unit test. | `tests/dashboard_data_utils.test.js` |
| AC-3 | Incompatible or malformed classified input fails through a controlled error path. | Unit test. | `tests/dashboard_data_utils.test.js` |
| AC-4 | The production page loads the new helper before `script.js`. | Metadata test. | `tests/prelaunch_metadata.test.js` |
| AC-5 | Same-origin app-shell requests are network-first, cache successful responses, and use cached content only on network failure. | Source-level regression test. | `tests/service_worker.test.js` |
| AC-6 | `players.json` retains network-first behavior with an offline cached fallback. | Source-level regression test. | `tests/service_worker.test.js` |
| AC-7 | The full JavaScript and Python regression suite remains green and the deployed-preview/manual state checks pass before merge. | Automated and browser checks. | `npm test`; recorded browser evidence. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Populated compatible data | Controller-only behavior; no isolated seam. | Helper returns validated `ready` state with finite bounds. | Unit |
| Valid zero-player preseason data | Controller-only behavior; no isolated seam. | Helper returns `preseason`. | Unit |
| Incompatible reader result | Controller-only behavior; no isolated seam. | Helper throws a controlled incompatibility error. | Unit |
| Existing app-shell cache after deploy | Cache-first resources can return stale shell content. | Network response wins; cache is fallback only. | Source-level regression plus manual browser check |
| Offline static player fallback | Existing network-first path. | Existing fallback remains intact. | Source-level regression |

## 9. Release and observability

No migration, new secret, scheduled task, or environment variable is required. The service-worker change takes effect when the browser receives the updated worker; `skipWaiting()` and `clients.claim()` remain in place. The rollback path is to revert the pull request, which restores the preceding cache behavior and app controller. A deployed browser check must include a normal data load, FDR open/close, visible player filtering, keyboard dialog close/focus restoration, and an explicit error/preseason-state observation when those controlled states are available.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Tests pass | Complete | `npm test`: 15 Jest suites / 81 JavaScript tests and 32 Python tests passed locally. |
| Browser/manual verification complete | Complete locally | `docs/verification/phase-10-quality-gate-local-browser-20260824.md` |
| Accessibility check complete | Complete locally | Player dialog opened and `Escape` restored focus to the invoking row. |
| Data invariants reviewed | Complete | No fixture, preseason, identity, authentication, credential, RLS, or publication behavior changed. |
| Deployment/release check complete | Pending preview | PR #67 CI passed; deployment-preview records were not accessible to this task. |
| Durable documentation updated | Complete | This specification and the local verification record |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-24 | Deliver dashboard-state seam and service-worker network-first safety as one narrow quality-gate slice. | Both reduce regression risk without changing user-visible product semantics or data boundaries. | Safe to implement without a migration or product-decision escalation. |
