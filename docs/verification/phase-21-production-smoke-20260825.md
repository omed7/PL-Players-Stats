# Phase 21 Production Browser Smoke — 25 August 2026

**Scope:** Team Filter View-Model and Selection Seam  
**Canonical origin:** `https://fpl-omed.vercel.app/`  
**Merged implementation pull request:** [#84](https://github.com/omed7/PL-Players-Stats/pull/84)  
**Status:** Passed

## Deployment propagation

The first post-merge canonical response loaded the existing public dashboard and 310 players but did not yet contain `team_filter_view_utils.js` or its callable global. This was treated as ordinary propagation, not accepted as release verification. After a 45-second interval and a fresh reload, the helper script and `FPLTeamFilterViewUtils.buildTeamFilterViewModel` global were both present.

| Check | Observed result | Status |
|---|---|---|
| Initial canonical response | Public dashboard loaded, but `helperLoaded` and `scriptLoaded` were both `false`. | Waiting for propagation |
| Fresh reload after 45 seconds | `helperLoaded: true` and `scriptLoaded: true`. | Passed |
| Public snapshot | 310 players loaded. | Passed |

## Team filter smoke

| Check | Observed result | Status |
|---|---|---|
| First Team selection | Selecting BHA changed the deployed control to `Team: BHA` and reduced the public table to **16** players. | Passed |
| Selected Team removal | Selecting BHA again restored `Filter by Team` and the **310**-player table. | Passed |

## Adjacent regression checks

| Check | Observed result | Status |
|---|---|---|
| Player-detail dialog | De Cuyper detail opened with existing public summary, season tiles, history/chart controls, match log, and fixture chips. | Passed |
| Keyboard dialog behavior | Escape dismissed the player-detail dialog and returned to the table. | Passed |

## Final checks

| Check | Observed result | Status |
|---|---|---|
| FDR navigation | FDR opened and Players returned to the deployed public table. | Passed |
| Console | No runtime errors were reported; the only console entry was the deliberate helper-presence probe. | Passed |
| Privacy boundary | No Team ID was submitted, no account sign-in occurred, and no FPL credential or user-preference action was performed. | Passed |

## Release conclusion

After normal propagation, canonical production served the Phase 21 helper and passed Team selection/clear plus adjacent dialog, keyboard, and FDR flows. The separately recorded preview-discovery limitation remains unchanged; canonical production verification is the accepted deployment evidence.
