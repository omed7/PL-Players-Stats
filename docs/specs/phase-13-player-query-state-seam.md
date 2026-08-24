# Phase 13 — Player Query-State and Pagination Seam

**Status:** Complete — pull request ready for review
**Owner:** omed7
**Date:** 24 August 2026
**Related issue / PR:** N/A

## 1. Outcome

Phase 13 should continue the Phase 12 decomposition of the browser controller by extracting the **deterministic player query pipeline**: filter selection, sort ordering, column maxima, and pagination bounds. The current controller mixes these decisions with DOM reads, state mutation, table rendering, and control updates. The new seam will make query behaviour directly testable without changing what a visitor sees or how controls behave.

The observable outcome is identical dashboard behaviour. Search, team and position filters, price and minutes constraints, watchlist and public Team ID squad restrictions, sorting, pagination, empty-result messaging, fixture chips, player actions, and FDR navigation must continue to work exactly as they do now.

> **Phase 13 is a maintainability and regression-coverage change, not a product-feature change.** It must preserve current output and interaction contracts.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add a small UMD/CommonJS `player_query_utils.js` module for pure filtering, sorting, column maxima, and pagination calculations. | Changing any user-facing filtering, sort, price, minutes, page-size, or default-sort behaviour. |
| Refactor `applyFiltersAndSort` and `updatePagination` to consume the utility while the controller retains state mutation and DOM rendering. | Changing rendering, row metrics, render-safety, fixture chips, FDR, dialogs, watchlist storage/sync, comparison, account sync, or Team ID fetch behaviour. |
| Add focused unit tests for raw and percentage minutes, inclusive price bounds, search/team/position selection, durable-ID restrictions, sort modes, maxima, and page clamping. | A framework migration, URL query persistence, server-side filtering, virtualisation, or a redesign of controls. |
| Preserve the existing dashboard error/preseason/no-results classification path. | Reclassifying empty results as preseason, errors, or football outcomes. |

## 3. Proposed boundary

The extracted module should be called **`player_query_utils.js`** and mirror the Phase 12 browser-global/CommonJS pattern. It should receive plain values only; it must not access `window`, `document`, local storage, account state, or network APIs.

| Pure function | Input | Output | Controller responsibility retained |
|---|---|---|---|
| `queryPlayers` | Compatible player records, timeframe prefix, maximum minutes, and normalized query criteria. | New filtered-and-sorted player array plus per-column maxima. | Read controls/state; set `state.filteredPlayers` and `state.columnMaxes`; update count; call render. |
| `getPagination` | Total items, page size, requested page. | Clamped current page, total pages, and slice boundaries. | Render page label, enable/disable buttons, and pass the current page to `renderTable`. |
| Optional narrow helpers | One focused predicate or sort-value helper where it reduces duplicated logic. | Deterministic values only. | All event wiring, visual state, and accessibility attributes. |

The utility will receive a **precomputed timeframe prefix and maximum minutes** from the current controller helpers. This deliberately avoids moving the display timeframe state-machine into Phase 13. The controller also continues to obtain valid public Team ID squad element IDs from the existing Team ID path and passes them to the pure query function as a set or array.

## 4. Required behaviour and invariants

| Concern | Required behaviour | Must not change |
|---|---|---|
| Minutes | Exclude zero-minute records; apply the existing raw-minutes threshold or rounded percent-of-window threshold. | The current threshold semantics, including boundary equality. |
| Price | Keep the established inclusive `priceMin`–`priceMax` range. | Slider clamps, baseline range, or price display. |
| Text and selection filters | Apply case-insensitive name search, selected-team membership, and position selection. | Existing filter conjunction semantics. |
| Durable restrictions | Apply watchlist and squad restrictions by **FPL element ID** only. | Any use of player display names as durable identifiers. |
| Sorting | Preserve name, numeric-stat, and points-per-price sorts with the current ascending/descending direction and stable ties. | Default column, default direction, or zero fallback for missing numeric metrics. |
| Column maxima | Preserve the current filtered-result maxima and `0.01` floor used by bar rendering. | Table metric rendering or bar-width formula. |
| Pagination | Preserve 15 items per page, a minimum of one visible page, and clamping when a requested page exceeds the new total. | The existing previous/next interaction or page-reset decisions. |
| Empty state | Return an empty filtered collection without interpreting its meaning. | The controller-owned distinction between load error, valid preseason, and no-results. |
| Fixtures | Leave fixture records and source-observed fixture rendering untouched. | Any inferred `BGW` outcome from absent fixture data. |

## 5. User journey

1. The dashboard obtains an already compatible player snapshot through the existing reader and initializes existing controls and personalisation state.
2. A visitor changes a search, position, team, price, minutes, watchlist, public-squad, sort, or pagination control.
3. The controller updates its existing state and asks the pure utility for the filtered/sorted result and pagination calculation.
4. The controller updates the existing count, headers, buttons, and table without changing markup, actions, fixture-chip policy, or keyboard behaviour.
5. When the result is empty, the existing dashboard-state logic still determines whether the visible message is no-results, unavailable data, or valid preseason.

## 6. Acceptance criteria

| ID | Acceptance criterion | Verification |
|---|---|---|
| AC-1 | Raw and percentage minute thresholds preserve current inclusive/exclusive boundary behaviour. | Focused unit tests. |
| AC-2 | Price, case-insensitive search, team, and position filters combine exactly as today. | Focused unit tests. |
| AC-3 | Watchlist and My Squad restrictions intersect using FPL element IDs and retain current empty-set semantics. | Focused unit tests. |
| AC-4 | Name, numeric-stat, and points-per-price sorting preserve direction, zero fallbacks, and stable ties. | Focused unit tests. |
| AC-5 | Column maxima match the filtered result and retain the `0.01` lower bound. | Focused unit tests. |
| AC-6 | Pagination clamps invalid/out-of-range pages, preserves the 15-row page size, and represents an empty result as page 1 of 1. | Focused unit tests. |
| AC-7 | The new helper is loaded before `script.js`; the controller consumes it without reintroducing DOM dependencies into the utility. | Metadata test and code review. |
| AC-8 | Populated, no-results, load-error, and valid-preseason states remain visibly distinct. | Existing dashboard-state tests plus browser check. |
| AC-9 | Keyboard player-detail dismissal, fixture chips, FDR open/return, and normal pagination remain functional. | Local and deployed-preview browser smoke. |

## 7. Test-first implementation plan

The implementation should begin by adding failing `tests/player_query_utils.test.js` cases and one script-order assertion. The initial test dataset should contain just enough compatible players to prove each decision, including duplicate sort values and distinct element IDs.

| Scenario | Expected pre-change result | Expected final result |
|---|---|---|
| Raw minutes boundary | Query helper absent. | Player at threshold is included; player below is excluded. |
| Percentage minutes boundary | Query helper absent. | Existing rounded percentage logic is preserved. |
| Combined filters | Query helper absent. | Only records satisfying all current criteria are returned. |
| Durable ID restrictions | Query helper absent. | Watchlist/squad selections match only by element ID. |
| Sorting | Query helper absent. | Name, numeric, value, direction, and stable ties match current output. |
| Maxima and zero values | Query helper absent. | Filtered maxima and `0.01` floors match current table-bar inputs. |
| Pagination | Query helper absent. | Page bounds are clamped and empty results remain page 1 of 1. |
| Browser regression | N/A. | Search/filter/sort/page controls, no-results state, row dialog `Escape`, and FDR round trip are unchanged. |

The final gate is `npm test`, a local populated-data smoke, a no-results control path, keyboard dialog dismissal, FDR open/return, and a deployed-preview smoke after the pull request is available.

## 8. Change set and release plan

| File | Proposed change |
|---|---|
| `player_query_utils.js` | New pure UMD/CommonJS query and pagination utility. |
| `script.js` | Delegate query/pagination calculations; retain controller state, DOM updates, event listeners, and render handoff. |
| `index.html` | Load the helper before `script.js`. |
| `tests/player_query_utils.test.js` | New focused regression suite. |
| `tests/prelaunch_metadata.test.js` | Add helper load-order assertion. |
| `docs/specs/phase-13-player-query-state-seam.md` | Approved specification and completion record. |
| `docs/verification/phase-13-*.md` | Local and deployed verification evidence, if needed. |

No migration, data refresh, environment change, service-worker policy change, secret, schedule, or database change is required. Rollback remains a standard revert of the implementation pull request because no persisted user data, snapshot schema, or API contract changes.

## 9. Sequencing and decision points

Phase 13 is the recommended next slice because Phase 12 deliberately deferred the filter/sort/pagination boundary and because it can be tested as plain data without expanding product scope. It should not begin until the following remains agreed:

| Decision | Proposed answer | Owner decision needed? |
|---|---|---|
| Phase 13 focus | Extract pure query, maxima, and pagination calculations only. | No; it follows the Phase 12 decision log. |
| UI semantics | Preserve all current behaviour, including page resets owned by event handlers. | No. |
| Query persistence | Do not introduce URL or storage persistence. | No. |
| Data/privacy impact | None; retain FPL element-ID restrictions and existing account boundaries. | No. |
| Future follow-up | Consider controller event-adapter consolidation only after Phase 13 is stable. | Yes, only when that future scope is proposed. |

## 10. Completion record

| Check | Result |
|---|---|
| Specification and boundary approved | Approved by owner on 2026-08-25 |
| Focused tests fail before implementation | Confirmed on 2026-08-25: utility module and script load tag were absent |
| Full test suite passes | Passed on 2026-08-25: 19 JavaScript suites / 96 tests and 32 Python tests |
| Local browser verification complete | Passed on 2026-08-25; see `docs/verification/phase-13-local-smoke-20260825.md` |
| Deployed-preview verification complete | Passed on 2026-08-25; see `docs/verification/phase-13-preview-smoke-20260825.md` |
| Data and privacy invariants reviewed | Complete: no snapshot, account, Team ID, fixture, or persistence contract changed |
| Durable documentation updated | This specification plus local, preview, and production smoke records under `docs/verification/` |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-24 | Propose query-state and pagination extraction as Phase 13. | It was explicitly deferred by Phase 12 and is the next high-value pure logic seam. | Controller event and DOM adapters stay stable while query behaviour gains direct regression coverage. |
| 2026-08-24 | Keep UI event handlers and state mutation in `script.js`. | It avoids a broad controller rewrite and preserves current page-reset and accessibility behaviour. | The extracted utility remains independent of browser APIs. |
| 2026-08-25 | Owner approved Phase 13 and requested focused failing tests first. | The existing pure-helper and test-first delivery pattern applies to the intended seam. | Implementation uses a small UMD/CommonJS utility with controller-owned DOM and state adapters. |
| 2026-08-25 | Complete local and ready-preview browser smoke before review. | The narrow code seam changes the filtering, sorting, maxima, and pagination handoff while preserving all user-visible behaviour. | Populated, no-results, goalkeeper/season, sorting, pagination, dialog Escape, and FDR round-trip evidence is recorded. |
| 2026-08-25 | Verify the merged deployment without creating artificial data-publication overlap. | Phase 13 does not change the fetch or publication workflow. | Production verification covers only public browser behaviour and is recorded in `docs/verification/phase-13-production-smoke-20260825.md`. |
