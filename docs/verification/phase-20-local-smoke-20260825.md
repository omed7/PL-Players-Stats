# Phase 20 Local Browser Smoke — 25 August 2026

**Scope:** Team Profile Controls View-Model Seam  
**Local origin:** `http://localhost:4200/` (fresh service-worker origin)  
**Status:** Passed

## Control-state verification

The fresh local origin loaded **310 players** and the new `FPLTeamProfileControlsViewUtils.buildTeamProfileControlsViewModel` browser helper. No real public Team ID lookup or account sign-in was performed because Phase 20 does not alter loader, credential, account, or persistence behavior.

| Check | Observed result | Status |
|---|---|---|
| Signed-out note | `Public lookup only. Team and preferences stay on this device.` | Passed |
| Disconnected action state | Team actions hidden; Connect label retained; input remained empty. | Passed |
| My Squad state | Disabled, inactive, and `aria-pressed="false"`. | Passed |
| Public player data | 310 players loaded on the fresh local origin. | Passed |

## Adjacent regression checks

| Check | Observed result | Status |
|---|---|---|
| Player-detail dialog | De Cuyper detail opened with the existing Last 5 summary, season tiles, history/chart controls, match log, and fixture chips. | Passed |
| Keyboard dialog behavior | Escape dismissed the player-detail dialog and returned to the table. | Passed |
| FDR navigation | FDR opened and Players returned to the table. | Passed |
| Console | No browser errors were reported; the only output was the intentional controls-state inspection. | Passed |

## Verification boundary

The browser smoke intentionally did not submit a Team ID or sign in, because Phase 20 does not change public lookup, account sync, persistence, or OAuth behavior. Connected, signed-in, and My Squad edge-state presentation are directly covered by the pure unit contract. No FPL credentials were requested, collected, stored, or transmitted.
