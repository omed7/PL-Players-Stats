# Phase 14 — FDR View-Model Seam

**Status:** Approved — implementation in progress
**Owner:** omed7
**Date:** 25 August 2026
**Related issue / PR:** N/A

## 1. Outcome

The FDR heatmap currently derives team fixtures, source-observed gameweeks, per-gameweek fixture groups, average difficulty, selected-team restrictions, and sort order directly inside the browser controller. Phase 14 moves only those deterministic decisions into a pure UMD/CommonJS helper so they receive direct regression coverage without changing the heatmap’s visible content or interactions.

> **Phase 14 is a testability and maintainability seam, not an FDR feature change.** Fixture rendering remains source-observed and unknown data remains unknown.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add `fdr_view_utils.js`, a pure browser/CommonJS helper that prepares the FDR view model from compatible player records, selected-team names, and sort mode. | Changing fixture acquisition, snapshot schema, FDR scoring, or user-facing fixture semantics. |
| Extract one fixture collection and logo per team, source-observed gameweeks, fixture grouping, average-FDR calculation, team filtering, and stable ordering. | Rendering `BGW`, treating absent fixture data as a blank, inventing a numeric gameweek range, or changing `TBC` behaviour. |
| Refactor `renderFDRHeatmap` to consume the prepared view model while retaining DOM creation and safe rendering. | Refactoring FDR open/close navigation, account sync, team-filter controls, player table, dialogs, persistence, or public Team ID. |
| Add direct Jest coverage and the script-load-order regression assertion. | A broad event-adapter consolidation, framework migration, URL persistence, or redesign. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Data source | Inputs are already compatible browser player records with optional per-player `fixtures`. | Existing public dataset reader and controller contract. | No |
| Team fixtures | The first available fixture array observed for each team remains the authoritative row source, matching current rendering. | Existing `renderFDRHeatmap` behaviour. | No |
| Gameweeks | Display only gameweek values explicitly found on fixture records; no range is inferred. | Fixture-truthfulness invariant. | No |
| Missing fixtures | A row cell with no source-observed fixture remains unknown and is rendered by the existing classifier as `TBC`. | Existing `fixture_utils` contract. | No |
| FDR metric | Preserve existing arithmetic mean of each team row’s source fixture difficulties and lowest-first average order. | Existing controller behaviour. | No |
| Privacy and persistence | The helper receives no account, Team ID, storage, credentials, DOM, or network APIs. | Phase boundary. | No |

## 4. User journey and behaviour

1. The dashboard loads a compatible public player snapshot and retains its current selected-team and FDR-sort state.
2. A visitor opens the FDR heatmap or changes the selected teams or existing FDR sorting control.
3. The controller calls the pure helper, receives source-observed gameweeks and prepared team rows, then renders the existing safe table markup.
4. A selected-team restriction shows only its matching source teams; alphabetical and average modes retain their current ordering.
5. If no source-observed gameweeks exist, the controller retains the existing “No upcoming fixtures available.” state. Missing fixture cells remain unknown rather than becoming football claims.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| Team name and logo | Compatible player records | One row identity and logo per source team. | A team with no observed fixtures can still be represented in the prepared model but does not create gameweeks. |
| Team fixture list | Compatible player records | Preserve the first non-empty source fixture collection per team, as today. | Missing fixture arrays provide no evidence of a blank. |
| Gameweek values | Source fixture records | Return a unique ascending union of observed `gw` values only. | Do not fabricate omitted gameweeks. |
| Per-gameweek fixtures | Source fixture records | Preserve all fixtures, including double gameweeks. | Empty/unobserved cells remain unknown for renderer classification. |
| Difficulty mean | Source fixture `difficulty` values | Preserve existing average and selected sort semantics. | Do not change displayed fixture difficulty or scoring. |
| User state | Controller state | Read only selected team names and FDR sort mode as plain inputs. | No account, storage, or privacy boundary change. |

> **Absence from a source response is not confirmation of a blank gameweek.** This phase must not introduce or infer `BGW` values.

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `fdr_view_utils.js` | New pure UMD/CommonJS `buildFdrViewModel({ players, selectedTeams, sortMode })`. | Isolates deterministic FDR data preparation from browser APIs. | Direct CommonJS Jest tests. |
| `script.js` | Replace the in-function grouping/filtering/sorting block in `renderFDRHeatmap`; retain headers, cells, `renderFixtureSlotHTML`, escaping, images, and no-fixture DOM state. | Keeps controller/UI ownership stable. | Existing browser FDR open/return smoke plus code review. |
| `index.html` | Load `fdr_view_utils.js` before `script.js`. | Browser global is available before the controller boots. | Metadata order test. |
| `tests/fdr_view_utils.test.js` | Add focused plain-data regression cases. | Encodes fixture truthfulness and FDR ordering directly. | Jest. |
| `tests/prelaunch_metadata.test.js` | Assert FDR helper load order. | Prevents browser-global regressions. | Jest. |

Rollback is a normal revert of the implementation pull request. No schema, data publication, migration, environment, service-worker, account, or persistence change is required.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | The helper returns exactly the unique ascending gameweeks observed in source fixtures, never an inferred range. | Focused Jest cases. | Pending |
| AC-2 | Teams retain the first available fixture list, logo, and all double-gameweek fixtures. | Focused Jest cases. | Pending |
| AC-3 | Per-team fixture groups retain known source fixtures; an omitted slot is represented only as an empty group for the existing unknown/TBC renderer. | Focused Jest cases plus fixture utility regression suite. | Pending |
| AC-4 | Selected team names filter rows conjunctively; no selection returns all source teams. | Focused Jest cases. | Pending |
| AC-5 | Average-FDR and alphabetical modes preserve existing ascending behavior and deterministic ties. | Focused Jest cases. | Pending |
| AC-6 | Teams with no observed fixtures do not manufacture gameweeks and the controller preserves the existing no-upcoming-fixtures UI state. | Focused Jest and browser smoke. | Pending |
| AC-7 | The pure utility contains no DOM, window, storage, account, or network dependency and loads before `script.js`. | Code review and metadata Jest test. | Pending |
| AC-8 | Existing FDR open/return, selected-team updates, safe fixture rendering, and keyboard/dialog flows remain functional. | Local and deployed-preview smoke. | Pending |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Ordinary fixtures across teams | `fdr_view_utils.js` absent. | Ordered source-observed gameweeks and prepared team rows. | Jest |
| Double gameweek | Helper absent. | Both source fixtures remain in that team/gameweek group. | Jest |
| Delayed or missing fixture data | Helper absent. | No inferred gameweek, blank, or `BGW`; the renderer receives empty/unobserved slots only. | Jest |
| Explicit fixture records | Helper absent. | Only source records influence groups and average FDR. | Jest |
| Selected-team filter | Helper absent. | Matching source team rows only; empty selection includes all teams. | Jest |
| Average and alphabetical order | Helper absent. | Existing ordering and stable ties are preserved. | Jest |
| Script loading | FDR helper tag absent. | Helper loads before controller. | Jest |
| Browser regression | N/A. | FDR open/return, selected-team filtering, no-upcoming-fixtures state, and existing fixture TBC semantics remain unchanged. | Local and preview browser smoke |

The first implementation step is to create `tests/fdr_view_utils.test.js` and the script-order assertion while the helper does not exist, then run those focused tests and capture the expected failure.

## 9. Release and observability

No data refresh, migration, deployment configuration, cache policy, external secret, schedule, or workflow change is needed. The pull request will use the normal test workflow and ready deployment preview. Local verification must use a fresh local origin to avoid stale service-worker state; preview verification must confirm the FDR open/return path without attempting any artificial concurrent data-publication run.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User approval |
| Focused tests fail before implementation | Confirmed on 2026-08-25: `fdr_view_utils.js` and its script tag are absent. | `npx jest tests/fdr_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Passed on 2026-08-25: 20 JavaScript suites / 102 tests and 32 Python tests. | `npm test` |
| Browser/manual verification complete | Local FDR smoke passed on 2026-08-25. | `docs/verification/phase-14-local-smoke-20260825.md` |
| Accessibility check complete | Existing FDR control labels and Players return action remained available in the local smoke. | Local browser smoke |
| Data invariants reviewed | Complete: source-observed gameweeks only; no inferred blank or BGW behavior introduced. | Focused unit and local browser checks |
| Deployment/release check complete | Pending | Pending |
| Durable documentation updated if needed | This specification | Pending |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extract the FDR view model before broad control-adapter consolidation. | Its grouping, source-observed gameweek collection, filtering, and sorting are deterministic and currently lack focused direct tests. | FDR DOM and navigation remain stable while fixture-truthfulness logic becomes directly testable. |
| 2026-08-25 | Preserve first available per-team fixtures and the current average-FDR calculation. | This is a maintainability slice, not an FDR behavior redesign. | No FDR score or visual-order product decision changes. |
| 2026-08-25 | Treat absent fixture data as unknown, never as a blank or `BGW`. | Core FPL data-truthfulness invariant. | The helper may produce no gameweeks or an empty per-cell fixture collection but must make no football assertion. |
| 2026-08-25 | Start implementation with utility and script-order tests that fail while both integration points are absent. | The approved test-first plan requires observable pre-change evidence. | The focused command failed exactly because `fdr_view_utils.js` and the `index.html` helper tag have not yet been added. |
| 2026-08-25 | Verify FDR locally from a fresh origin before opening the implementation pull request. | A stale service worker can conceal current browser code. | The local smoke used port 4184 and covered populated FDR, alphabetical sort, selected-team filtering, and the Players return path. |
