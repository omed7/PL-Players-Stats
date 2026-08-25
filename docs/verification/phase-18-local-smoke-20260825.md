# Phase 18 Local Browser Smoke — 25 August 2026

**Scope:** Watchlist drawer view-model seam  
**Branch:** `feat/watchlist-view-model-seam`  
**Origin:** `http://localhost:4198/`  
**Purpose:** Verify the changed drawer path on a fresh origin, avoiding any stale service-worker context.

## Result

The local smoke passed. The fresh origin loaded the public snapshot with **310 players** and no browser-console output. The watchlist drawer rendered the current Last 5 metrics from the new model while retaining existing card markup, safe public image output, fixture chips, mutation behavior, and dialog/navigation interactions.

| Check | Observed result | Status |
|---|---|---|
| Public-data load | The app loaded 310 players on the fresh local origin. | Passed |
| Populated drawer card | Adding De Cuyper rendered one card with `17 pts`, `3.8 pts/£m`, and `xGI 1.68`, plus the existing BHA crest and five fixture chips. | Passed |
| Drawer removal | The visible card remove control reset the header and drawer count to `0`, changed the row control back to “Add De Cuyper to watchlist,” and rendered the existing empty state. | Passed |
| Empty drawer | The drawer showed “No players starred yet. Click ★ on any player row.” after removal. | Passed |
| Watchlist-only | With De Cuyper selected, the drawer’s visible Only control filtered the table to **Players 1**. Removing the final card restored the normal **Players 310** view. | Passed |
| Drawer keyboard behavior | Escape dismissed the open empty drawer and returned to the unchanged player-table view. | Passed |
| Player-detail dialog | De Cuyper detail opened with current Last 5 values; Escape dismissed it without error. | Passed |
| FDR navigation | FDR opened with its fixture matrix; its Players control returned to the player table. | Passed |
| Browser console | The console reported no output. | Passed |

## Notes

The smoke intentionally used no account sign-in and entered no Team ID. It therefore exercised only public snapshot data and local watchlist state. Phase 18 does not modify account synchronization, persistence schema, Team ID flows, fixture/FDR derivation, or user-owned data handling.

The browser actions finished with an empty local watchlist and the normal, unfiltered 310-player table.
