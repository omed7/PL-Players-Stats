# Phase 20 Production Browser Smoke — 25 August 2026

**Scope:** Team Profile Controls View-Model Seam  
**Canonical origin:** `https://fpl-omed.vercel.app/`  
**Merged implementation PR:** [#82](https://github.com/omed7/PL-Players-Stats/pull/82)  
**Status:** Passed

## Deployment and control-state verification

Canonical production loaded `team_profile_controls_view_utils.js`, and `window.FPLTeamProfileControlsViewUtils.buildTeamProfileControlsViewModel` was callable before accepting browser smoke. The production dashboard then loaded **310 players**.

No real public Team ID lookup or account sign-in was performed because Phase 20 does not change loader, proxy, account, persistence, OAuth, or credential behavior.

| Check | Observed result | Status |
|---|---|---|
| Helper deployment | Helper script present and exported function callable. | Passed |
| Signed-out note | `Public lookup only. Team and preferences stay on this device.` | Passed |
| Disconnected action state | Team actions hidden; Connect label retained; input empty. | Passed |
| My Squad state | Disabled, inactive, and `aria-pressed="false"`. | Passed |
| Public data | Canonical dashboard displayed 310 players. | Passed |

## Adjacent regression checks

| Check | Observed result | Status |
|---|---|---|
| Player-detail dialog | De Cuyper detail opened with the existing current-period summary, season tiles, history/chart controls, match log, and fixture chips. | Passed |
| Keyboard dialog behavior | Escape dismissed the player-detail dialog and returned to the table. | Passed |
| FDR navigation | FDR opened and Players returned to the table. | Passed |
| Console | No browser errors were reported; the only console output was the intentional helper and controls-state inspection. | Passed |

## Verification boundary

Production smoke intentionally did not submit a Team ID or sign in because Phase 20 does not change public lookup, account synchronization, persistence, OAuth, or credential behavior. Connected, signed-in, and My Squad edge-state presentation remain directly covered by focused pure utility tests. No FPL credential was requested, collected, stored, or transmitted.
