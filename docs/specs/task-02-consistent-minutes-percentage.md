# Feature Specification — Consistent minutes-percentage filtering

**Status:** Implemented; local tests and browser checks passed; PR/CI review pending

**Owner:** omed7

**Date:** 2026-10-28

**Related PR:** Branch `fix/consistent-minutes-percentage`, targeting main after PR #88.

## 1. Outcome

A player whose table shows a minutes percentage meeting the selected minimum must not be removed by a different percentage calculation. Query and display will share the existing display rule: use the supplied period `min_pct` when present, otherwise the existing rounded minutes/max-minutes fallback.

## 2. Scope and non-goals

In scope: extract a pure percentage helper in the existing table-metrics module, use it from query and table metrics, and add Node/browser-global regressions. Out of scope: fetcher formulas, data eligibility, history slicing, fixtures, raw-minutes behavior, other filters/sorts, UI layout, auth, credentials, SQL, dependencies, deployment and automatic merge.

## 3. Assumptions and decisions

- Base is merged main `27ef65a67d4f6662b754d24e052606890fc041e3`.
- Supported source records already contain period percentages. Preserve that statistic rather than redefining its denominator here.
- A supplied zero is real data, not a signal to derive another number. Null/missing values keep the established fallback.
- The table-metrics module is pure and has no DOM dependency; it already owns this calculation and loads before the query module in HTML. Reuse it instead of adding a dependency/package or duplicating a formula.

## 4. User journey and behavior

Select Last 5, Last 10 or Season; turn on percentage mode; choose a minimum. The same percentage shown in the row determines inclusion. Raw-minutes mode and exclusion of zero-minute period records remain unchanged.

## 5. Data contract and invariants

No data file or source statistic changes. Preserve supplied `min_pct` values, including zero and values above 100, and the existing fallback rounding/zero-safe denominator. Preserve valid preseason, explicit-only BGW rules, durable IDs, accounts and all other query criteria.

## 6. Technical design

Export a small pure `getPlayerMinutesPercentage` helper from `player_table_utils.js`. Table metrics and `player_query_utils.js` both use it. Resolve the existing module through CommonJS in tests/Node and the existing global in the browser; verify actual script order and browser-global execution. No new circular dependency.

## 7. Acceptance criteria

- AC1: Early-season/short-window supplied percentages determine filtering, not a fixed 5/10-match maximum.
- AC2: Query inclusion agrees with displayed percentage at below/equal/above thresholds across Last 5, Last 10 and Season.
- AC3: Supplied zero is honored; missing/null values retain fallback rounding; raw filters/zero-minute exclusion do not change.
- AC4: Existing script order and browser-global path work; all existing tests pass.
- AC5: Actual snapshot reproduction and signed-out browser smoke are recorded. No production updater or data write is triggered.

## 8. Test plan

Add query/display parity tests before implementation and record their expected failure against old code. Cover short windows, boundary values, zero/null/missing values, raw mode, zero-minute rows and browser-global loading. Run focused suites, `npm test`, whitespace checks and an actual UI smoke test using the local proposed code.

## 9. Release and observability

Deliver on a separate branch/PR; review actual diff and CI. No merge or manual deployment is authorized for this change yet. Rollback by reviewed PR if needed, retaining PR88's main-only publishing protections and the owner-selected existing-key mode.

## 10. Completion record

| Check | Result |
|---|---|
| Regression before implementation | Focused run: 9 failed / 14 passed; the new parity cases exposed the old filter rule |
| Focused verification after implementation | 23 passed across consistency, query and table-metrics suites |
| Complete regression suite | `npm test`: 164 JavaScript tests / 27 suites + 32 Python tests passed (196 total); inherited credentials removed |
| Existing snapshot | GW8, 451 players, fetched 2026-10-28 09:04:02 UTC: Last-10/90% count 0 before, 83 after, matching displayed percentages |
| Formula/raw-mode preservation | Hashes of every displayed metric and raw-mode query output across all three periods remained identical before/after |
| Actual signed-out browser | Real local app, public Supabase source: Last5/90%=96, Last10/90%=83, Season/90%=83; expected ID sets matched. Raw Last10/500 minutes=155, as expected. Raya remained included at 720m/100%; the substring search also correctly matched Rayan |
| Source scope | Only two pure-helper modules, one regression file and this specification. No player data, aggregation/formula, auth, SQL, workflow, dependency or layout change |
| Merge/deployment | Not performed; actual PR CI evidence belongs in the containing PR. Temporary local HTTP preview only; no real fetcher/publisher or production-data write |

Existing mobile layout/accessibility and offline cache/deployment-mixing issues are not claimed fixed by this repair.

## Decision log

| Date | Decision | Reason |
|---|---|---|
| 2026-10-28 | Align query with the existing displayed period percentage | Fix an audit-confirmed inconsistency without redesigning football statistics |
