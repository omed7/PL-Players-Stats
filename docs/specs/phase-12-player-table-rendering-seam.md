# Phase 12 — Player-Table Rendering Seam

**Status:** Draft — implementation approval pending  
**Owner:** omed7  
**Date:** 24 August 2026  
**Related issue / PR:** N/A

## 1. Outcome

The primary player table is rendered inside the 2,276-line browser controller. Its row metric formatting and column-visibility rules are deterministic but currently coupled to DOM creation, event listeners, watchlist/comparison state, and modal opening. This slice extracts only the pure table-presentation decisions into a tested utility while keeping the controller as the DOM and interaction adapter.

The observable outcome is unchanged dashboard behaviour: filters, sort order, pagination, row values, visible columns, fixture chips, watchlist/comparison actions, modal opening, keyboard interaction, loading/error/preseason/no-results distinctions, and source-observed fixture semantics all remain unchanged. The new utility creates a stable verification seam for table presentation without a framework migration or a redesign.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add a small UMD `player_table_utils.js` module for pure column-visibility and per-row metric/view-model decisions. | Changing filter, sort, search, price, minutes, Team ID, watchlist, comparison, pagination, or modal product behaviour. |
| Refactor `renderTable` to consume the utility while retaining current DOM creation and event-listener ownership. | Rewriting the table with a framework, virtualisation library, template engine, or component system. |
| Add focused unit tests for goalkeeper/season visibility, stat precision, min-percent fallback, points-per-price handling, and zero/empty numeric boundaries. | Changing the public snapshot schema, FPL fetcher, fixture/FDR logic, service worker, Supabase, RLS, account sync, or FPL credential policy. |
| Keep the existing public-data render-safety helper at all template boundaries. | Consolidating unrelated dashboard helpers in the same pull request. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Product behaviour | `renderTable` remains the browser adapter; it continues to own DOM nodes, click handlers, modal opening, fixture chips, watchlist/comparison buttons, and accessibility attributes. | Current controller responsibilities. | No |
| Pure extraction boundary | Column visibility and formatted row metrics do not require the DOM or account state and can be verified as pure data. | Current `renderTable` implementation. | No |
| Filter/sort boundary | `baseFilter` and `applyFiltersAndSort` remain in the controller for this slice. Their public outputs feed the same paginated `state.filteredPlayers` array. | Surgical-scope decision. | No |
| Data correctness | The utility accepts an already compatible player record; it does not loosen public snapshot validation or make football assertions. | Existing reader/schema boundary. | No |
| Fixture invariant | Existing `buildFixtureChipsHTML` remains responsible for source-observed fixture slots; absence remains unknown/TBC, never inferred `BGW`. | Project invariant. | No |
| Compatibility | The utility uses the current browser-global plus CommonJS pattern used by existing helpers. | Existing test/browser loading convention. | No |

## 4. User journey and behaviour

1. The dashboard receives a compatible public snapshot and computes its existing filtered, sorted, paginated player collection.
2. The controller calls the pure table utility with the selected timeframe, position filter, maximum minutes, player record, and column maxima.
3. The utility returns deterministic column visibility and formatted numeric row fields; the controller creates the same table cells, controls, fixtures, and event listeners as before.
4. A user can search, filter by position/team/price/minutes, sort, paginate, open player details, toggle watchlist/comparison, and view fixtures with no visible change.
5. If the filtered result is empty, the existing controller still distinguishes load error, valid preseason zero-player data, and no-results states; the new helper is not asked to reclassify those conditions.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| Player record | Existing compatible public snapshot | Preserve existing source values and formatting precision for the selected timeframe. | The existing reader and dashboard-state logic handles invalid/unavailable data. |
| Timeframe prefix | Existing controller state | Continue to use `last_5_`, `last_10_`, or `season_` fields without changing selection behaviour. | Existing default/fallback remains unchanged. |
| Minutes percentage | Player timeframe fields plus maximum minutes | Use the existing supplied `min_pct` when present; otherwise use the existing rounded derived percentage. | A zero/empty minutes value remains a displayed zero under the existing filter rules. |
| Column visibility | Position filter and timeframe | Goalkeeper and season-only column rules remain identical to the current table. | No new unavailable-data claim is created. |
| Fixture chips | Existing fixture helper | Render only source-observed fixtures; unknown slots remain TBC. | Never infer `BGW` from absent fixture data. |
| Durable player identity | FPL element ID | Preserve the element ID for watchlist, comparison, Team ID picks, and DOM action attributes. | No display-name persistence. |

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `player_table_utils.js` | Add a UMD utility with `getTableColumnVisibility` and `buildPlayerTableRowMetrics` pure functions. | Moves deterministic presentation calculations out of the controller without coupling utility code to browser DOM. | Jest unit tests. |
| `script.js` | `renderTable` calls the utility for visibility decisions and metric formatting; keeps DOM markup, render-safety, chips, event handlers, state updates, and dialogs intact. | Small coherent refactor with no user-visible behavioural change. | Existing browser smoke plus new utility tests. |
| `index.html` | Load the utility before `script.js`. | Makes the tested utility available at controller initialisation. | Metadata test. |
| `tests/player_table_utils.test.js` | Add regression tests for table-format decisions. | Establishes a focused pure logic gate before refactoring. | Jest. |
| `tests/prelaunch_metadata.test.js` | Add load-order assertion. | Prevents a silent production helper-order regression. | Jest. |

The proposed utility input is plain data and receives no `document`, `window`, event, account, or persistence dependency. `renderTable` keeps existing `safePublicPlayer`, `buildFixtureChipsHTML`, `toggleWatch`, `toggleCompare`, `openPlayerModal`, and DOM event handling. The change is reversible by restoring the current inline calculations and removing the script tag; it does not require a migration or cache/schema change.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Goalkeeper/non-goalkeeper and season/non-season column visibility exactly matches current rules. | Focused unit tests. | `tests/player_table_utils.test.js` |
| AC-2 | A representative outfield player produces current stat precision, points-per-price, and supplied minutes percentage. | Focused unit test. | `tests/player_table_utils.test.js` |
| AC-3 | Missing `min_pct`, zero price, and missing optional stat fields use the current safe fallbacks without `NaN`, `Infinity`, or changed text precision. | Focused unit tests. | `tests/player_table_utils.test.js` |
| AC-4 | The browser loads the utility before `script.js`. | Metadata regression test. | `tests/prelaunch_metadata.test.js` |
| AC-5 | Filters, sorting, pagination, watchlist, comparison, Team ID highlighting, row modal, and source-observed fixture chips retain their existing contract. | Full suite and local/deployed browser journey. | Test output and verification record. |
| AC-6 | Empty load-error, preseason, and no-results states remain classified by existing dashboard-state logic. | Existing dashboard-data tests plus browser/source review. | `tests/dashboard_data_utils.test.js` |
| AC-7 | No public snapshot field bypasses the existing render-safety helper in the table adapter. | Code review and normal populated browser check. | Pull-request diff and verification record. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Outfield, last-five table | Formatting is embedded inside `renderTable`. | Equivalent pure row metrics feed the same DOM cells. | Unit + browser |
| Goalkeeper, season table | Visibility is embedded inside `renderTable`. | Same saves/stat visibility; field-player xG-family columns remain hidden. | Unit |
| Missing `min_pct` | Inline rounded fallback. | Identical rounded fallback. | Unit |
| Zero price | Inline `0.0` points-per-price fallback. | Identical `0.0` fallback. | Unit |
| Empty search/filter state | Controller chooses no-results, load-error, or preseason message. | Existing controller behaviour unchanged. | Existing tests + browser/source review |
| Fixture data missing for a slot | Existing fixture helper renders unknown/TBC. | Unchanged; no inferred blank gameweek. | Existing fixture tests + browser |
| Keyboard player dialog | Existing row click opens dialog and Escape restores focus. | Unchanged after adapter refactor. | Browser |

The implementation pull request must begin with failing unit and metadata tests, then pass `npm test`, local browser verification of populated/empty states, dialog keyboard behaviour, and a deployed-preview smoke check.

## 9. Release and observability

No database migration, snapshot refresh, environment variable, secret, workflow, schedule, or service-worker change is expected. The new JavaScript file will use the existing application-shell delivery path and must be deployed with `index.html` in the same release. Rollback is a standard pull-request revert because no data contract or persisted user data changes.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Focused tests fail before implementation | Pending implementation |  |
| Tests pass | Pending implementation |  |
| Browser/manual verification complete | Pending implementation |  |
| Accessibility check complete | Pending implementation |  |
| Data invariants reviewed | Complete for specification | No fixture, schema, identity, privacy, or credential change proposed. |
| Deployment/release check complete | Pending implementation |  |
| Durable documentation updated if needed | Complete | This specification. |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-24 | Extract only pure column-visibility and row-metric presentation rules first. | It creates a high-value test seam while retaining all browser interaction ownership in the controller. | The refactor remains narrow, reversible, and behaviour-preserving. |
| 2026-08-24 | Defer filter/sort/pagination extraction. | Those functions couple state, UI controls, and result counts; combining them would exceed a focused rendering slice. | A later specification can address filter-state extraction after this seam is stable. |
