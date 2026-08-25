# Phase 18 Production Browser Smoke — 25 August 2026

**Scope:** Watchlist drawer view-model seam  
**Merged pull request:** [#78](https://github.com/omed7/PL-Players-Stats/pull/78)  
**Production commit:** `75e7b2e` (`Extract watchlist drawer view model`)  
**Canonical origin:** <https://fpl-omed.vercel.app/>

## Result

Canonical production smoke passed after PR #78 merged. Production loaded the Phase 18 browser helper and the current public snapshot with **310 players**. The watchlist drawer rendered the expected current-period card values and retained its existing safe card presentation, fixture chips, mutation behavior, and adjacent dialog/navigation paths.

| Check | Observed result | Status |
|---|---|---|
| Deployed helper | `window.FPLWatchlistViewUtils.buildWatchlistViewModel` was present on the canonical production origin. | Passed |
| Public snapshot | After load, the canonical table contained 310 players. | Passed |
| Populated drawer | Adding De Cuyper produced one card with `17 pts`, `3.8 pts/£m`, and `xGI 1.68`, retaining the BHA crest and five fixture chips. | Passed |
| Removal and empty state | The visible drawer remove control reset the header/drawer count to `0`, returned the table control to Add, and restored “No players starred yet. Click ★ on any player row.” | Passed |
| Drawer accessibility | Escape dismissed the open empty drawer. | Passed |
| Player dialog | De Cuyper detail opened with the current Last 5 values and dismissed with Escape. | Passed |
| FDR navigation | FDR opened the fixture matrix and its Players control returned to the player table. | Passed |
| Browser console | No browser errors were reported. The only console lines were the intentional helper-presence diagnostic used for this smoke. | Passed |

## Verification boundary

The production check used only public snapshot data. No account sign-in or Team ID was entered, and the smoke ended with an empty local watchlist. Phase 18 does not alter persistence schema, account synchronization, Supabase/RLS, Team ID, fixture/FDR logic, data publication, or privacy handling.

The pull-request preview remains unavailable through the current deployment integration; see `docs/verification/phase-18-preview-smoke-20260825.md`. Canonical production, local browser smoke, and passing CI provide the recorded release evidence.
