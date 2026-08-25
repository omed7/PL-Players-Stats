# Phase 17 — Player-Detail Form-Chart View-Model Seam

**Status:** Approved — implementation in progress
**Owner:** omed7
**Date:** 25 August 2026
**Related issue / PR:** N/A

## 1. Outcome

The player-detail modal currently calculates recent-form chart maxima, normalized heights, semantic bar classes, and numeric display values inline in the browser controller. Phase 17 extracts those deterministic chart decisions into a pure browser/CommonJS utility, enabling focused regression coverage while preserving the modal’s current visual output, metric controls, match-history semantics, safe rendering, and accessible dialog behavior.

> A visitor opening a player detail still sees the same selected completed matches, chart metric buttons, bar heights and classes, match labels, and detail-dialog behavior. The controller simply renders a tested chart model rather than calculating form-bar values itself.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add `player_detail_chart_utils.js` with pure form-chart value, maximum, height, class, and display calculations. | Redesigning the player-detail modal, chart metrics, labels, stat tiles, match log, or fixture chips. |
| Add direct Jest tests for current points, minutes, generic-metric, zero, malformed-data, formatting, and chronological-order behavior. | Changing existing `history_utils` match selection, completed-match rules, venue filter, limit control, or double-gameweek behavior. |
| Load the helper before `script.js` and refactor only `formBarsHtml` to consume it. | Changing account, Team ID, watchlist, comparison, persistence, FDR, data publication, or privacy behavior. |
| Complete local, preview, and production browser smoke for the changed dialog path. | Broad event-adapter consolidation, framework migration, or dependencies. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Match order | The helper preserves the supplied selected history order; `history_utils` remains the authority for history selection/sorting. | Existing controller and `history_utils` tests. | No |
| Chart metrics | Existing keys and thresholds stay unchanged: points `9/6/2/0`; minutes `60/>0/0`; generic metrics `>60%/>20%/>0`. | Existing `formBarsHtml` behavior. | No |
| Numeric safety | Missing, non-finite, and non-numeric values become zero; chart maxima use `0.01` minimum; heights remain finite and within 0–100. | Existing zero-safe max intent; approved scope. | No |
| Labels and escaping | Utility returns raw record association and numeric data only; the controller uses the existing history label and HTML escaping path. | Existing render-safety boundary. | No |
| Privacy and data correctness | The helper makes no network, storage, account, fixture, or player-identity decision. | Approved scope. | No |

## 4. User journey and behaviour

1. A visitor opens a player-detail dialog from the player table.
2. The controller keeps the existing schema/venue/limit flow to obtain ordered recent matches through `history_utils`.
3. The controller asks the utility for the active metric’s chart bars and renders the existing safe markup from that pure model.
4. Selecting a chart metric recomputes and renders the same bars for the retained match sequence.
5. Escape and close actions retain the existing dialog close and focus-restoration behavior. No-match history retains the existing empty state.

## 5. Data contract and invariants

| Entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| Match sequence | Existing `history_utils` selected records or legacy `gw_history` | Preserve supplied order; do not filter, regroup, or infer games. | Empty input returns an empty chart model. |
| Metric value | `record[metric]` | Convert finite numeric values; invalid/missing input is zero. | Zero value and 0% height. |
| Maximum | Active-metric values | `max(values..., 0.01)` to avoid division by zero. | All-zero input has 0.01 maximum and finite bars. |
| Bar class | Existing threshold semantics | Preserve current points, minutes, and generic classifications exactly. | Zero/invalid input receives existing zero class. |
| Match label | Existing `history_utils.matchLabel` controller adapter | Do not generate, escape, or alter labels in the utility. | Renderer continues its existing fallback/escaping behavior. |
| Fixture/FDR information | Not read | Do not infer fixtures, gameweeks, blank gameweeks, or FDR. | Not applicable. |

## 6. Technical design

`player_detail_chart_utils.js` will be a DOM-free UMD/CommonJS utility. It exposes a form-chart builder accepting an ordered match array and metric key, returning `{ maximum, bars }`, where each bar includes the input record reference, finite value, rounded percentage height, existing class, and display value. The helper performs no string escaping and no HTML generation.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `player_detail_chart_utils.js` | Add pure form-chart calculations. | Isolate untested chart decisions. | Direct CommonJS Jest tests. |
| `tests/player_detail_chart_utils.test.js` | Add focused data-driven regressions. | Preserve threshold, order, zero, and malformed-data semantics. | Jest. |
| `script.js` | Add one helper accessor and render `formBarsHtml` from returned bars. | Preserve controller markup, labels, listeners, and dialog behavior. | Browser smoke. |
| `index.html` / metadata test | Require script order before controller. | Prevent missing global helper regression. | Static Jest. |

Rollback is a focused reversion of helper, tests, script tag, adapter, and documentation. No migration, data refresh, configuration, or environment change is required.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | The utility preserves supplied match order and returns finite values and 0–100 heights for every metric input. | Unit | Focused Jest. |
| AC-2 | Points, minutes, and generic bar classes exactly follow existing threshold semantics. | Unit | Focused Jest. |
| AC-3 | Empty, zero-only, missing, and non-numeric metric values remain safe with a `0.01` maximum floor. | Unit | Focused Jest. |
| AC-4 | The controller uses the utility for form bars but retains history selection, raw-label escaping, HTML, metric controls, and dialog lifecycle. | Code review + browser | Pull-request diff + smoke. |
| AC-5 | Helper order is before `script.js`; all tests pass. | Static + full regression | Jest + `npm test`. |
| AC-6 | Local, preview, and production dialog smoke passes for an active chart metric, no-history path where available, metric switching, Escape, and player/FDR navigation. | Browser | Verification records. |
| AC-7 | No account, Team ID, persistence, fixture/FDR, data-publication, snapshot, or privacy behavior changes. | Scope review | Pull-request diff. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Points thresholds | Helper import fails. | `9/6/2/0` classify high/medium/low/zero with stable height output. | Unit |
| Minutes thresholds | Helper import fails. | `60/>0/0` classify high/medium/zero. | Unit |
| Generic thresholds | Helper import fails. | Values above 60%, above 20%, positive, and zero classify high/medium/low/zero. | Unit |
| Zero/malformed history | Helper import fails. | Maximum is 0.01; values/heights remain finite and zero-safe. | Unit |
| Ordering and formatting | Helper import fails. | Input order and expected integer/decimal display formatting are preserved. | Unit |
| Script order | Static assertion fails. | Helper loads before controller. | Jest |
| Browser regression | Not run before implementation. | Detail dialog, metric switching, Escape/focus, and navigation remain correct locally, on preview, and in production. | Browser |

The intentional red command is:

```text
npx jest tests/player_detail_chart_utils.test.js tests/prelaunch_metadata.test.js --runInBand
```

After implementation run the focused command, `npm test`, `git diff --check`, fresh-origin local smoke, preview smoke, and merged-production smoke.

## 9. Release and observability

No data refresh, migration, environment variable, cache rule, or social metadata change is required. The normal pull-request preview is the delivery preview. Verification records must capture the detail dialog’s active chart, a metric toggle, Escape/focus behavior, return navigation, and browser-console state.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User approval |
| Focused tests fail before implementation | Confirmed on 2026-08-25: the module and ordered helper script are absent. | `npx jest tests/player_detail_chart_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Passed on 2026-08-25: 22 JavaScript suites / 114 tests and 32 Python tests. | `npm test` |
| Browser/manual verification complete | Fresh-origin local smoke passed on 2026-08-25. | `docs/verification/phase-17-local-smoke-20260825.md` |
| Accessibility check complete | Existing metric controls and Escape dismissal remained available in local smoke. | Local browser smoke |
| Data invariants reviewed | Complete: chart utility reads supplied history metric values only and makes no fixture/FDR, player-identity, or account decision. | Focused unit and local browser checks |
| Deployment/release check complete | Pending | Pending |
| Durable documentation updated if needed | This specification | Pending |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extract form-chart calculations after history selection is already utility-backed. | The remaining maxima, normalization, classes, and formatting are deterministic but untested. | History selection stays stable while the visual model gains direct regression coverage. |
| 2026-08-25 | Preserve supplied match order and all current bar thresholds. | Phase 17 is a maintenance seam, not a chart redesign. | No user-visible product rule intentionally changes. |
| 2026-08-25 | Keep labels, escaping, markup, controls, and dialog lifecycle in the controller. | The pure helper must remain DOM-free and not bypass render-safety. | Existing safety and accessibility ownership remains unchanged. |
| 2026-08-25 | Start with utility and script-order red tests. | The approved delivery protocol requires test-first evidence. | The focused command failed exactly because `player_detail_chart_utils.js` and its ordered `index.html` script tag are absent; controller behavior remains unchanged. |
| 2026-08-25 | Verify the dialog path on a fresh local origin before creating the pull request. | A stale service worker could conceal browser code changes. | The local smoke on port 4195 covered populated detail, xG metric switching, Escape dismissal, FDR return navigation, and an empty console. |
