# Phase 15 — Comparison View-Model and Radar-Metrics Seam

**Status:** Approved — implementation in progress
**Owner:** omed7
**Date:** 25 August 2026
**Related issue / PR:** N/A

## 1. Outcome

The comparison modal currently combines durable selection decisions, current-timeframe stat normalization, comparative maxima, best-value detection, and radar-coordinate mathematics inside the large browser controller. Phase 15 will extract those deterministic decisions into a pure, browser/CommonJS-safe utility so they receive direct regression coverage while the existing comparison journey remains visually and behaviorally unchanged.

> A user can add, remove, and compare up to three players exactly as today. The modal, stat bars, best indicator, and radar display preserve their established outputs; the controller retains all DOM, dialog, safe-rendering, and interaction ownership.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add `comparison_view_utils.js` with pure selection-transition and comparison-view-model calculations. | Any comparison feature, ranking, stat-definition, visual, or copy redesign. |
| Add direct Jest coverage for durable numeric selection, the three-player cap, stat maxima/bars/best values, and radar coordinates. | Changes to comparison persistence, watchlist behavior, account synchronization, Team ID flow, or Supabase/RLS. |
| Refactor only `toggleCompare`, `syncAllCmpButtons`, `syncCmpBar`, `buildRadarSVG`, and the deterministic preparation inside `openCompareModal` to consume the helper. | Broad control-event consolidation, framework migration, URL persistence, or new dependencies. |
| Require `comparison_view_utils.js` to load before `script.js`. | Replacing controller-owned safe HTML, image URL, SVG, DOM, button, modal, keyboard, or focus-trap code. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Player identity | Comparison selection stays ordered by FPL `element_id`; display names remain presentation-only. | Existing durable-ID invariant; approved owner scope. | No |
| Product behavior | A valid comparison retains at most three ordered players. Toggling an already-selected ID removes it; a fourth distinct ID is rejected without mutation. | Existing controller behavior; approved owner scope. | No |
| Current-period data | Stat values use the existing timeframe prefix supplied by the controller, such as `last_5_`, `last_10_`, or `season_`. | Existing controller `pfxFor()` contract. | No |
| Numeric safety | Missing/non-numeric stat values resolve to zero; high-is-best maxima have a `0.01` floor, and radar values are clipped to `[0, 1]`. | Existing comparison/radar calculations. | No |
| Rendering and accessibility | The controller continues to escape names, validate public image URLs, create SVG/HTML, set ARIA attributes, open/close dialogs, and restore focus. | Existing render and dialog adapters. | No |
| Privacy and persistence | Phase 15 makes no storage, network, Team ID, account, or database change. | Approved scope. | No |

## 4. User journey and behaviour

1. A visitor presses `+` for a player row. The controller asks the utility for the resulting ordered comparison selection and preserves the existing visual slot assignment.
2. The controller refreshes existing row buttons and comparison-bar chips using the returned selection; it retains safe player display values and accessible labels.
3. With two or three resolvable selected players, a visitor opens Compare. The utility supplies stat rows, normalized bars, best-value/tie data, and radar geometry derived from the existing timeframe values.
4. The controller renders the established comparison modal and activates the existing accessible dialog behavior. If fewer than two selected IDs resolve to players, the modal remains closed as today.
5. Missing comparison-stat values become neutral zero values. No fixture, football, player-availability, or team claim is inferred by this feature.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| Comparison ID | Controller comparison set / player `element_id` | A positive safe integer; preserve selected order; deduplicate; cap at three. | Ignore invalid candidate IDs and unresolved player IDs without changing valid selection. |
| Player record | Current public player snapshot | Resolve selected IDs only from supplied records; never resolve by name. | Unresolved IDs do not create a modal player model. |
| Timeframe prefix | Existing controller `pfxFor()` | Read only the existing prefixed stat keys. | Missing/non-numeric values are numeric zero. |
| Stat maxima and bars | Existing comparison stat definitions | High-is-best row maxima use `max(values..., 0.01)` and bar widths never become `NaN`/infinite. | Render zero-width, neutral bar data. |
| Best-value state | Existing stat-row semantics | Preserve all ties and expose a deterministic first-best slot for the existing single-dot renderer. | A fully tied row remains visibly non-distinct, as today. |
| Radar geometry | Existing 200px, 12-axis radar contract | Generate deterministic finite points from normalized/clipped current-period values. | Zero/missing rows remain centered; no invalid SVG coordinates. |
| Fixture and FDR data | Not read by the utility | Do not infer fixtures, blank gameweeks, or FDR outcomes. | Not applicable. |

## 6. Technical design

The new UMD/CommonJS module exposes only pure values and performs no DOM, window, storage, network, account, or rendering mutation. A small selection transition returns the next ordered IDs and outcome. A comparison model builder accepts ordered IDs, public player records, the timeframe prefix, current stat definitions, and radar definitions, then returns resolved selected players, stat-row values, maxima, best/tie metadata, and precomputed radar geometry. It returns no modal model when fewer than two selected IDs resolve.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `comparison_view_utils.js` | Add pure selection and comparison/radar view-model calculations using UMD/CommonJS export. | Isolate the controller’s deterministic comparison logic. | Direct CommonJS Jest tests. |
| `tests/comparison_view_utils.test.js` | Add focused test-first data-driven regressions. | Prove stable durable-ID, normalization, tie, and coordinate behavior. | Jest. |
| `script.js` | Add one helper accessor and delegate deterministic comparison preparation only. | Preserve controller DOM, safe rendering, and dialog/event ownership. | Existing controller + browser smoke. |
| `index.html` | Load the helper before `script.js`. | Ensure browser dependency order. | Static metadata Jest assertion. |
| `tests/prelaunch_metadata.test.js` | Assert helper script ordering. | Prevent a missing browser global regression. | Jest. |

The rollback path is to revert the focused utility, adapter, test, script tag, and specification commits. There are no migrations, stored records, data publications, or environment changes.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Comparison selection accepts positive safe FPL element IDs, removes selected IDs, preserves order, deduplicates, and refuses a fourth distinct player. | Unit | Focused Jest cases. |
| AC-2 | The utility resolves only selected `element_id` records and returns no modal model when fewer than two valid players resolve. | Unit | Focused Jest cases. |
| AC-3 | Current-period stat values, maxima, normalized bar widths, best value, and all-tied state match current high-is-best semantics and retain the `0.01` floor. | Unit | Focused Jest cases. |
| AC-4 | Radar axes, labels, and player points are deterministic, finite, normalized, clipped, and slot-stable for zero, missing, tied, and oversized values. | Unit | Focused Jest cases. |
| AC-5 | The helper loads before `script.js`; the controller retains safe display construction, modal DOM, listeners, accessibility labels, and dialog lifecycle. | Static test + code review | Jest + pull-request diff. |
| AC-6 | Existing compare selection, modal opening, chart rendering, Escape dismissal, and player-table/FDR navigation remain functional on a fresh local origin and deployed preview. | Browser + deployed preview | Verification records. |
| AC-7 | No account, persistence, Team ID, fixture-source, publication, public-data, or privacy behavior changes. | Scope review + regression suite | Pull-request diff + `npm test`. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Ordered add/remove selection | Fails because helper module does not exist. | Valid IDs toggle deterministically; invalid and fourth IDs leave selection unchanged. | Unit |
| Duplicate/unresolved selection | Fails because helper module does not exist. | Duplicate IDs resolve once; unresolved IDs cannot manufacture modal players. | Unit |
| Stats and bar normalization | Fails because helper module does not exist. | Prefixed values, maxima floor, bar widths, first best slot, and full ties match established semantics. | Unit |
| Radar zero/missing/oversized values | Fails because helper module does not exist. | Centered finite points for zero/missing values and clipped outer points for oversized values. | Unit |
| Helper load order | Fails because no helper script is present. | The helper is ordered before `script.js`. | Static Jest |
| Existing interaction regression | Not run before implementation. | Selection slots, compare modal, radar, Escape, navigation, and empty-console paths pass locally and on preview. | Browser |

The expected pre-implementation command is:

```text
npx jest tests/comparison_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand
```

After implementation, run the focused command, then `npm test`, `git diff --check`, a fresh-origin local browser smoke, and a ready-preview smoke.

## 9. Release and observability

No data refresh, migration, environment variable, cache policy, social metadata, workflow, or production configuration change is required. The feature ships with the normal pull-request preview. The local and preview smoke records must note compare selection, modal/radar rendering, Escape focus behavior, player-table/FDR navigation, and browser-console state.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User approval |
| Focused tests fail before implementation | Confirmed on 2026-08-25: the module and ordered helper script are absent. | `npx jest tests/comparison_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Pending | Pending |
| Browser/manual verification complete | Pending | Pending |
| Accessibility check complete | Pending | Pending |
| Data invariants reviewed | Pending | Pending |
| Deployment/release check complete | Pending | Pending |
| Durable documentation updated if needed | This specification | Pending |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extract comparison/radar calculations before a broad control-adapter consolidation. | Selection, maxima, bar normalization, and geometry are deterministic and lack direct focused coverage. | The controller retains all DOM and dialog behavior while comparison calculations become testable. |
| 2026-08-25 | Preserve three ordered FPL-element-ID slots and existing stat/radar definitions. | This is a maintainability seam, not a comparison-product redesign. | Existing user behavior, visual slots, and values remain stable. |
| 2026-08-25 | Do not add fixture or FDR interpretation to the utility. | Comparison data uses current-period player metrics only; fixture facts require separate source safeguards. | The no-inferred-BGW and unknown-fixture invariants remain untouched. |
| 2026-08-25 | Start with intentional utility and script-order test failures. | The approved delivery protocol requires observable pre-change regression evidence. | The focused command failed exactly because `comparison_view_utils.js` and its `index.html` helper tag are absent; no controller behavior changed. |
