# Phase 18 — Watchlist Drawer View-Model Seam

**Status:** Approved — implementation in progress  
**Owner:** omed7  
**Date:** 25 August 2026  
**Related issue / PR:** N/A

## 1. Outcome

The watchlist drawer currently resolves persisted FPL element IDs to public player records and calculates period-specific points, xGI, points-per-£m, and drawer emptiness inline in the browser controller. Phase 18 extracts those deterministic decisions into a pure browser/CommonJS utility, enabling direct regression coverage while preserving the existing drawer layout, safe rendering, fixture chips, remove behavior, durable-ID persistence, account synchronization, and accessibility lifecycle.

> A visitor sees the same watchlist ordering, player cards, current-period metrics, fixture chips, and remove controls. The controller simply renders a tested card model instead of performing persisted-ID resolution and metric preparation itself.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add `watchlist_view_utils.js` with DOM-free watchlist ID resolution and card-metric preparation. | Redesigning watchlist cards, drawer layout, count badge, remove control, or fixture chips. |
| Add focused Jest tests for durable ID handling, stale IDs, timeframe metrics, numeric safety, price-zero display, order, and empty data. | Changing watchlist persistence, legacy migration, Supabase/account sync, RLS, or Team ID behavior. |
| Load the helper before `script.js` and refactor only drawer data preparation to use it. | Changing `safePublicPlayer`, HTML escaping, image validation, fixture/FDR logic, player query filtering, or table rendering. |
| Verify populated and empty watchlist paths locally, on preview where discoverable, and in production. | Broad event-adapter consolidation, countdown/freshness work, framework migration, or dependencies. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Durable identity | Watchlist membership continues to use only already-numeric positive integer FPL `element_id` values; strings are not coerced. | `persistence_utils.normalizeElementIds` and tests. | No |
| Visible order | The helper preserves the supplied watchlist ID order after normalization; it does not sort cards. | Existing `Set` iteration controller behavior. | No |
| Stale membership | An ID with no current player record is omitted from the visible model; no player is inferred or matched by name. | Existing controller silently skips missing map entries. | No |
| Timeframe | The caller provides the existing period prefix; the helper reads the corresponding `points` and `xGI` keys only. | Existing `renderWatchlistDrawer` behavior. | No |
| Numeric display | Invalid/missing metric values are zero; price at or below zero displays the existing em dash rather than dividing. | Existing zero fallback and price branch. | No |
| Render safety and fixtures | The utility returns data only. The controller retains safe public-player handling, escaping, image URLs, and fixture-chip HTML. | Existing render-safety and fixture boundaries. | No |

## 4. User journey and behaviour

1. A visitor opens the existing watchlist drawer.
2. The controller passes the current player collection, ordered durable watchlist IDs, and active timeframe prefix to the utility.
3. The utility returns the visible card model in the established order, omitting stale IDs and computing current-period display metrics.
4. The controller retains safe-player transformation, fixture-chip generation, card markup, and remove-button listeners.
5. Removing a card still invokes the current durable-ID mutation, persistence, account synchronization, badge update, and drawer refresh flow.
6. An empty or all-stale visible model retains the existing empty-drawer state.

## 5. Data contract and invariants

| Entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| Watchlist IDs | Existing `state.watchlist` set or ordered durable ID input | Preserve only supplied values that are already positive integer element IDs, deduplicate them, and preserve first occurrence order. | Strings and invalid values are ignored. |
| Player resolution | Current public `state.players` | Resolve by `element_id` only. | Missing/stale IDs produce no card. |
| Period metrics | `${prefix}points`, `${prefix}xGI` | Convert finite numeric values; missing or invalid values become zero. | Display `0` points and `0.00` xGI. |
| Price efficiency | Resolved player `price` | For a positive finite price, format points/price to one decimal; otherwise use `—`. | No division error or infinity. |
| Card order | Normalized watchlist input | Preserve supplied order; do not sort by points, name, price, or ownership. | Empty result remains empty. |
| Player presentation | Existing controller render path | Utility must not create labels, images, HTML, fixture chips, or public strings. | Controller retains existing safe rendering. |
| Fixtures/FDR | Not read | Do not infer fixtures, gameweeks, blank gameweeks, or FDR. | Not applicable. |

## 6. Technical design

`watchlist_view_utils.js` will be a DOM-free UMD/CommonJS helper. It exposes a model builder accepting `{ players, watchlistElementIds, prefix }` and returns `{ cards, count }`. Each card contains the original resolved player reference, its durable `elementId`, finite raw metrics, and formatted metric fields needed by the existing controller markup. It performs no storage, network, account, fixture, safe-HTML, or HTML-generation work.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `watchlist_view_utils.js` | Add pure durable-ID and metric-preparation model. | Isolate untested watchlist drawer decisions. | Direct CommonJS Jest tests. |
| `tests/watchlist_view_utils.test.js` | Add focused data-driven regression coverage. | Preserve ID/order/timeframe/numeric semantics. | Jest. |
| `script.js` | Add one accessor and render cards from the returned model. | Keep DOM, safe rendering, fixture chips, and events in controller. | Browser smoke. |
| `index.html` / metadata test | Require helper load before controller. | Prevent missing-global regression. | Static Jest. |

Rollback is a focused reversion of the helper, tests, script tag, adapter, and documentation. No migration, publication, configuration, or data refresh is required.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Valid numeric/string durable IDs resolve in supplied order with duplicates and invalid IDs removed. | Unit | Focused Jest. |
| AC-2 | Missing/stale IDs never create inferred cards or name matches. | Unit | Focused Jest. |
| AC-3 | Last 5, Last 10, and Season prefixes select only the corresponding points/xGI metrics. | Unit | Focused Jest. |
| AC-4 | Missing/non-finite metrics are zero-safe; non-positive price displays `—`; formatting matches the current drawer. | Unit | Focused Jest. |
| AC-5 | The controller consumes the utility but retains safe player/image handling, fixture chips, markup, remove events, dialog lifecycle, and account behavior. | Code review + browser | Pull-request diff + smoke. |
| AC-6 | Helper order is before `script.js`; all tests pass. | Static + full regression | Jest + `npm test`. |
| AC-7 | Local, preview where discoverable, and production smoke cover populated/empty drawer, remove behavior, Escape/focus, and player/FDR navigation. | Browser | Verification records. |
| AC-8 | No persistence, account, Team ID, RLS, fixture/FDR, data-publication, snapshot, or privacy behavior changes. | Scope review | Pull-request diff. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| ID normalization/order | Helper import fails. | Positive numeric/string IDs dedupe and preserve first-occurrence order. | Unit |
| Stale and invalid IDs | Helper import fails. | Missing player, zero, negative, and nonnumeric IDs create no cards. | Unit |
| Timeframe metrics | Helper import fails. | Prefix-specific points/xGI values are selected exactly. | Unit |
| Price and metric safety | Helper import fails. | Zero/non-finite price uses `—`; invalid metrics become finite zero displays. | Unit |
| Empty collection | Helper import fails. | Empty/all-stale input returns zero cards and count zero. | Unit |
| Script order | Static assertion fails. | Helper loads before controller. | Jest |
| Browser regression | Not run before implementation. | Populated/empty drawer, remove behavior, Escape/focus, and navigation remain correct. | Browser |

The intentional red command is:

```text
npx jest tests/watchlist_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand
```

After implementation, run the focused command, `npm test`, `git diff --check`, a fresh-origin local smoke, a preview attempt, and merged-production smoke.

## 9. Release and observability

No data refresh, migration, environment variable, cache rule, social metadata, account configuration, or publication workflow change is required. Verification records must capture ordered populated cards, one stale or empty result path where available, remove behavior, Escape/focus, player/FDR navigation, and browser-console state.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User approval |
| Focused tests fail before implementation | Confirmed on 2026-08-25: the module and ordered helper script were absent. | `npx jest tests/watchlist_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Passed on 2026-08-25: 23 JavaScript suites / 120 tests and 32 Python tests; whitespace check passed. | `npm test` and `git diff --check` |
| Browser/manual verification complete | Fresh-origin local smoke passed on 2026-08-25. | `docs/verification/phase-18-local-smoke-20260825.md` |
| Accessibility check complete | Drawer and player-detail Escape dismissal passed in local smoke; watchlist-only reset remained intact after final removal. | Local browser smoke |
| Data invariants reviewed | Complete: the helper resolves only already-numeric positive element IDs, omits stale IDs, and makes no fixture/FDR, account, persistence, or rendering-safety decision. | Focused tests and scope review |
| Deployment/release check complete | PR CI passed for implementation commit `8b5bcf3`; deployment-preview discovery is unavailable, while merge and production smoke remain pending. | `docs/verification/phase-18-preview-smoke-20260825.md` |
| Durable documentation updated if needed | Local verification record added. | This specification and local smoke record |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extract drawer data preparation after durable-ID persistence and account sync are already utility-backed. | The remaining ID resolution and card metrics are deterministic but untested in the controller. | Watchlist presentation gains focused coverage without widening persistence scope. |
| 2026-08-25 | Preserve input order and omit stale IDs. | The existing controller iterates `state.watchlist` and skips unresolved IDs. | No watchlist product behavior intentionally changes. |
| 2026-08-25 | Keep safe rendering, fixture chips, DOM, events, and lifecycle in the controller. | The pure helper must not bypass established security/accessibility ownership. | Render-safety and dialog behavior remain unchanged. |
| 2026-08-25 | Start with utility and script-order red tests. | The approved delivery protocol requires test-first evidence. | The focused command failed exactly because `watchlist_view_utils.js` and its ordered `index.html` script tag were absent. |
| 2026-08-25 | Use strict numeric element-ID inputs in the new helper. | `persistence_utils.normalizeElementIds` accepts only positive integer values and does not coerce strings. | Drawer behavior stays consistent with persisted watchlist semantics; test coverage rejects string coercion. |
| 2026-08-25 | Verify the changed drawer on a fresh local origin before creating the pull request. | A stale service worker could conceal browser code changes. | Port 4198 smoke covered populated and empty drawer states, remove, watchlist-only/reset, Escape, detail dialog, FDR return, and an empty console. |
| 2026-08-25 | Treat canonical production smoke as the hosted verification source when preview discovery is denied. | The deployment context exposed only an unrelated project and FPL deployment listing returned 403; no verifiable preview URL was available. | PR CI and fresh-origin local smoke form the pre-merge gate, followed by mandatory canonical production smoke. |
