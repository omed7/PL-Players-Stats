# Phase 19 — Player-Detail Snapshot View-Model Seam

**Status:** Approved — implementation in progress  
**Owner:** omed7  
**Date:** 25 August 2026  
**Related issue / PR:** N/A

## 1. Outcome

The player-detail controller still derives deterministic availability, current-period snapshot, season-tile, and match-log display data inline. Phase 19 extracts those decisions into a pure browser/CommonJS helper so that they are directly regression-tested, while the existing player-detail modal continues to render the same content, use the same history selection and chart helper, and retain the same safe rendering and dialog behavior.

> Opening a player detail must continue to show the same timeframe label, availability treatment, current-period values, season statistics, and match-log values. The controller will render a tested plain-data snapshot rather than calculating those values itself.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add DOM-free UMD/CommonJS `player_detail_snapshot_utils.js`. | Redesigning player-detail UI, CSS, labels, statistics, chart controls, or copy. |
| Build deterministic data for timeframe label, availability, current-period snapshot, season tiles, and match-log rows. | Changing global timeframe selection, `pfxFor`, filters, sorting, pagination, or player-table rendering. |
| Add direct Jest coverage for formatting, zero/invalid numeric inputs, availability thresholds, position-specific tiles, and match-log ordering. | Changing `history_utils` completed-match selection, venue-first filtering, last-N slicing, labels, double-gameweek treatment, or Phase 17 chart logic. |
| Load the helper before `script.js`; adapt only `openPlayerModal` data preparation. | Changing safe rendering, fixture chips, images, HTML markup, event listeners, focus trap, or dialog lifecycle ownership. |
| Complete automated, local, preview-attempt, and canonical-production verification. | Changing Team ID, account sync, watchlist/comparison, persistence, Supabase/RLS, fixtures/FDR, publication, snapshots, or privacy behavior. |

## 3. Assumptions and decisions

| Topic | Decision | Evidence / owner | Open? |
|---|---|---|---|
| Current timeframe labels | Preserve existing labels exactly: `last_5` → `Last 5 Matches`; `last_10` → `Last 10 Matches`; any existing season path → `This Season`. | Existing `openPlayerModal` behavior; owner-approved Phase 19 proposal. | No |
| Availability | Preserve current valid numeric bands: 0, 1–25, 26–50, 51–75, and 76–99 show the same injury badge classes; valid values of 100 or more show Available. | Existing controller behavior. | No |
| Invalid numerics | Convert missing, non-numeric, and non-finite metrics to safe finite display values; invalid price preserves the existing em dash rather than dividing. | Existing zero-safe intent and approved test seam. | No |
| Season tiles | Preserve existing labels, precision, and `Saves` for GK versus `Bonus` for outfield players. | Existing controller behavior. | No |
| Match history | Preserve supplied record order; retain raw-record association but do not select, label, escape, or alter history. | `history_utils` remains the selection authority. | No |
| Privacy/data correctness | The helper does not access DOM, storage, account state, network, player persistence, fixtures, FDR, or credentials. | Approved scope and engineering invariants. | No |

## 4. User journey and behavior

1. A visitor opens a player-detail dialog from the player table.
2. The controller retains its current schema, venue, and match-limit flow to select the ordered match history through `history_utils` or the existing legacy fallback.
3. The controller supplies the selected player, active prefix/timeframe, and selected history to the helper.
4. The helper returns plain snapshot data for the existing modal markup. The controller continues to escape labels, build safe player display data and fixture chips, bind controls, and activate the dialog.
5. Existing metric/history controls rerender the same dialog path, and Escape/close actions retain focus-restoration behavior. Empty history retains its existing no-match-log treatment.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behavior |
|---|---|---|---|
| Timeframe | Existing controller `state.timeframe` | Return current labels without changing global timeframe state. | Unrecognised existing path uses the established `This Season` fallback. |
| Current metrics | Supplied `player[`${prefix}points`]`, `xGI`, `minutes`, and `min_pct` | Use finite numeric values and preserve xGI two-decimal display. | Missing/non-finite value is safe zero. |
| Points per £m | Current points and supplied `player.price` | Preserve one-decimal result when price is finite and positive. | Zero, missing, or invalid price returns `—`; never divide by zero. |
| Availability | Supplied `player.status_pct` | Preserve current valid threshold classes and raw percent association. | Invalid value uses a neutral available-compatible result; no new medical claim is created. |
| Season tiles | Supplied season fields and `player.position` | Preserve labels and current display precision; only GK gets Saves. | Count-like missing/invalid values retain existing missing-safe display; rate metrics are finite. |
| Match-log row | Supplied selected history record | Preserve input order and raw record reference; preserve points class and xG/xA/minutes/bonus displays. | Empty input returns an empty list; invalid numerical values remain finite and safe. |
| Match labels | Existing controller `historyUtils.matchLabel` and escaping adapter | Helper does not label, escape, or generate HTML. | Controller retains fallback and escaping behavior. |
| Fixtures/FDR | Not read | Do not classify fixtures, BGWs, TBCs, or FDR. | Not applicable. |
| Durable identity/account | Not read | Do not make element-ID, storage, account, Team ID, or RLS decisions. | Not applicable. |

## 6. Technical design

`player_detail_snapshot_utils.js` will expose `buildPlayerDetailSnapshot({ player, prefix, timeframe, matchHistory })`. The exact field names are test-driven, but the returned DOM-free model will include a period label, availability data, numeric-safe current-period data, season tile data, and ordered match-log row data. It returns raw data only and does not create HTML or escape text.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `player_detail_snapshot_utils.js` | Add pure snapshot preparation. | Isolate currently inline deterministic decisions. | Direct CommonJS Jest tests. |
| `tests/player_detail_snapshot_utils.test.js` | Add data-driven red-first coverage. | Preserve formatting, thresholds, order, and zero safety. | Jest. |
| `index.html` and metadata test | Load helper before controller and assert the order. | Prevent missing-global dependency regressions. | Static Jest. |
| `script.js` | Add one helper accessor and consume its model only within `openPlayerModal`. | Preserve controller rendering, safety, listeners, charts, and lifecycle. | Code review and browser smoke. |

Rollback is a focused reversion of the helper, tests, script tag, controller adapter, and Phase 19 documentation. No migration, data refresh, environment variable, cache rule, workflow, or deployment configuration change is required.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | The helper returns the existing period labels for Last 5, Last 10, and season paths. | Unit | Focused Jest. |
| AC-2 | Current points, xGI, minutes, minute percentage, and points-per-£m preserve existing normal-data formatting and remain finite under malformed input. | Unit | Focused Jest. |
| AC-3 | Zero/missing/invalid price returns exactly `—`; no divide-by-zero or non-finite value is rendered. | Unit | Focused Jest. |
| AC-4 | Existing availability threshold classes and raw percentage behavior are preserved for valid values. | Unit | Focused Jest. |
| AC-5 | Season tiles preserve labels, precision, and GK Saves/outfield Bonus selection. | Unit | Focused Jest. |
| AC-6 | Match-log rows preserve supplied order, points bands, raw record association, and safe numeric displays; empty history returns no rows. | Unit | Focused Jest. |
| AC-7 | The controller uses the helper only for snapshot preparation while retaining history selection, label escaping, safe display/image handling, fixture chips, markup, controls, and dialog lifecycle. | Code review + browser | Pull-request diff and smoke. |
| AC-8 | Helper load order is before `script.js`; full test suite and whitespace check pass. | Static + regression | Jest, `npm test`, and `git diff --check`. |
| AC-9 | Fresh-origin local smoke, preview attempt, and canonical production smoke verify the detail path, current values, chart control, Escape/focus, FDR return, and console state. | Browser | Verification records. |
| AC-10 | No account, Team ID, persistence, fixture/FDR, data-publication, snapshot, or privacy behavior changes. | Scope review | Pull-request diff. |

## 8. Test plan

The intentional red command is:

```text
npx jest tests/player_detail_snapshot_utils.test.js tests/prelaunch_metadata.test.js --runInBand
```

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Timeframe labels | Helper import and script order fail. | Exact Last 5, Last 10, and season labels. | Unit + static |
| Current metrics | Helper import fails. | Existing normal-data values and finite malformed-data fallbacks. | Unit |
| Price guard | Helper import fails. | Positive-price one-decimal value; zero/missing/invalid price is `—`. | Unit |
| Availability boundaries | Helper import fails. | Existing 0/25/50/75/available treatment. | Unit |
| Season tiles | Helper import fails. | Existing labels, precision, and position-specific tile. | Unit |
| Match-log rows | Helper import fails. | Supplied order, points bands, displays, and empty history. | Unit |
| Script order | Static assertion fails. | Helper loads before controller. | Static Jest |
| Browser regression | Not run before implementation. | Detail snapshot, chart toggle, Escape/focus, FDR return, and no-console-error state remain correct. | Browser |

After implementation, run the focused command, `npm test`, `git diff --check`, fresh-origin local smoke, a deployed-preview attempt, and merged canonical-production smoke.

## 9. Release and observability

Use a fresh localhost port/origin for browser smoke so an older service worker cannot mask the new browser code. The normal implementation pull request must pass CI before merge. Attempt read-only preview discovery; if deployment access remains unavailable, record the limitation without inventing a URL and complete the required canonical-production smoke after merge. Record local, preview-limitation, and production evidence; create and merge a docs-only production-evidence PR if that remains the current release discipline.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User approval |
| Focused tests fail before implementation | Confirmed on 2026-08-25: the helper module and ordered helper script were absent. | `npx jest tests/player_detail_snapshot_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Passed on 2026-08-25: 24 JavaScript suites / 127 tests and 32 Python tests; whitespace check passed. | `npm test` and `git diff --check` |
| Browser/manual verification complete | Fresh-origin local smoke passed on 2026-08-25. | `docs/verification/phase-19-local-smoke-20260825.md` |
| Accessibility check complete | Detail dialog Escape dismissal and FDR return passed in local smoke. | Local browser smoke |
| Data invariants reviewed | Complete: the helper uses only supplied player/history data, preserves existing labels/valid value rules, and makes no fixture/FDR, identity, account, persistence, or privacy decision. | Focused tests and scope review |
| Deployment/release check complete | Implementation PR #80 merged; canonical production helper and functional smoke passed after normal propagation. Preview discovery remains unavailable through the current integration. | `docs/verification/phase-19-production-smoke-20260825.md` and `docs/verification/phase-19-preview-smoke-20260825.md` |
| Durable documentation updated if needed | Specification plus local, preview, and production verification records added. | Phase 19 evidence records |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extend the player-detail decomposition with a summary view-model seam. | Phase 17 isolated chart calculation, while deterministic snapshot preparation remains inline and untested. | The modal gains direct coverage without a UI redesign or broad controller refactor. |
| 2026-08-25 | Keep labels, escaping, markup, fixture chips, controls, and dialog lifecycle in the controller. | A pure helper must not bypass existing render-safety or accessibility ownership. | Phase 19 remains a data-preparation seam only. |
| 2026-08-25 | Preserve current visible rules and improve only malformed-data safety. | This is maintenance extraction, not a product-rule change. | Normal valid data keeps the same user-visible output. |
| 2026-08-25 | Start with direct helper and script-order red tests. | The approved delivery protocol requires focused failing evidence before implementation. | The focused command failed exactly because `player_detail_snapshot_utils.js` and its `index.html` script tag were absent. |
| 2026-08-25 | Verify the changed modal on a fresh local origin before opening the pull request. | A stale service worker could conceal browser code changes. | Port 4199 smoke covered Last 5/Last 10 summaries, season tiles, match log, xG chart integration, Escape, FDR return, and an empty console. |
| 2026-08-25 | Treat canonical production smoke as the hosted verification source when preview discovery is denied. | The deployment context exposed only an unrelated project and FPL deployment listing returned 403; no verifiable preview URL was available. | Local browser smoke and PR CI form the pre-merge gate, followed by mandatory canonical production smoke. |
| 2026-08-25 | Require proof that canonical production serves the helper before accepting UI smoke. | The first post-merge canonical responses were still on the preceding script list. | After a 45-second propagation interval, the helper tag and callable global were verified before modal smoke; full production evidence passed. |
