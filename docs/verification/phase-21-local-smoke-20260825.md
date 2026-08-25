# Phase 21 Local Browser Smoke — 25 August 2026

**Scope:** Team Filter View-Model and Selection Seam  
**Local origin:** `http://localhost:4201/` (fresh service-worker origin)  
**Status:** Passed

## Baseline

The fresh local origin loaded **310 public players** before Team filter interaction. No Team ID, account sign-in, raw picks, or personal preference change was used because Phase 21 changes only public Team filter presentation and selection transition preparation.

| Check | Observed result | Status |
|---|---|---|
| Public data | 310 players loaded on the fresh local origin. | Passed |
| Initial Team label | `Filter by Team` before selection. | Passed |
| Baseline privacy | No Team ID submission, sign-in, or account/persistence interaction occurred. | Passed |

## Team filter interaction

| Check | Observed result | Status |
|---|---|---|
| Team item list | Opened Team filter displayed the expected alphabetical public club list, including BHA. | Passed |
| First selection | Selecting BHA changed the toggle to `Team: BHA` and reduced the table to **16** BHA players. | Passed |
| Selected-button removal | Selecting BHA again restored `Filter by Team` and the **310**-player unfiltered table. | Passed |

## Adjacent regression checks

| Check | Observed result | Status |
|---|---|---|
| Helper availability | The model-backed Team list and selection/clear paths executed successfully on the fresh local origin. | Passed |
| Player-detail dialog | De Cuyper detail opened with the existing summary, season tiles, history/chart controls, match log, and fixture chips. | Passed |
| Keyboard dialog behavior | Escape dismissed the player-detail dialog and returned to the table. | Passed |
| FDR navigation | FDR opened and Players returned to the table. | Passed |
| Console | Browser console was empty after the complete smoke path. | Passed |

## Verification boundary

The browser smoke used only public Team filter interaction. It did not submit a Team ID, sign in, write account data, or alter saved preferences. No FPL credentials were requested, collected, stored, or transmitted.
