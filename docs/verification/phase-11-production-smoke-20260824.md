# Phase 11 — Production Smoke Check

**Status:** In progress  
**Date:** 24 August 2026  
**Production URL:** `https://fpl-omed.vercel.app/`

## Recorded checks

The merged production dashboard loaded successfully after its asynchronous public-data request. It rendered **279 players**, current GW1 countdown information, a **£3.0m–£15.5m** price range, player rows, filters, pagination, account controls, and the FDR entrypoint without a visible load error. The displayed snapshot was approximately **15 hours and 36 minutes** old at the time of inspection.

This confirms the merged dashboard-data helper is compatible with the live data contract. Remaining production checks are FDR navigation, keyboard dialog dismissal/focus restoration, active service-worker control, and console errors.

The production FDR heatmap opened successfully, displayed source-observed fixture columns from GW2 through GW38, and returned to the populated player table without a data or navigation error. The check preserved the invariant that fixture data is displayed only when observed in the source; no blank gameweek was inferred.

A production player-detail dialog opened from the populated table and pressing `Escape` dismissed it, returning to the populated player table. This confirms the merged release retains keyboard dialog dismissal and focus-restoration behavior in production.

The production browser reported an active, controlling service worker at `https://fpl-omed.vercel.app/sw.js` with the expected production scope. The console contained only the explicit service-worker inspection and no client-side error output after the smoke journey.

## Publication-health observation

The latest scheduled `Update FPL data` workflow completed successfully, as did the preceding four observed publication runs. The current committed snapshot uses schema version 2, contains 279 players, identifies GW1 with a `2026-08-28T17:30:00Z` deadline, and was fetched at `2026-08-24T03:42:40Z`. The production freshness label was consistent with that timestamp. This is a healthy observed publication state; it does not replace regression coverage for workflow failures or overlapping-run protection.

## P2 branch local-browser check

The P2 branch was served locally through a temporary static host. It loaded the same compatible 279-player snapshot, displayed current freshness and the £3.0m–£15.5m range, and rendered the normal player table without a visible error. This confirms normal populated data remains compatible with the render-safety helper.

The local P2 FDR heatmap rendered populated team and fixture data and returned to the player table without a navigation error. This confirms the fixture and team encoding changes preserve the existing source-observed FDR journey.

The local P2 player-detail dialog rendered its expected data and fixtures. `Escape` dismissed the dialog and returned to the populated table, preserving the existing keyboard/focus behavior through the renderer changes.

## Post-merge production confirmation

After PR #68 merged to `main` (`f6e9ac15c57a28e4964f642f7570ba9ca37e5620`), the live dashboard loaded the compatible 279-player snapshot with the expected £3.0m–£15.5m range and an age label consistent with the published snapshot. The normal populated state was preserved after the render-safety release.

The post-merge production FDR heatmap rendered populated, source-observed fixtures and returned to the populated player dashboard without a navigation or data error. This confirms the merged safe fixture and team rendering preserves the live FDR journey.

A merged-production player-detail dialog rendered its normal player, history, and fixture content. `Escape` dismissed the dialog and returned focus to the dashboard table, preserving the accessibility behavior through the deployed render-safety change.

After a forced production refresh, the populated dashboard remained available. The browser reported an active, controlling worker at `https://fpl-omed.vercel.app/sw.js` with the production scope, confirming the live application shell is controlled after the merged release.

The post-refresh production console contained only the explicit service-worker inspection and no observed client-side error output.

## Publication-concurrency assessment

The merged workflow declares the shared `fpl-data-publication` concurrency group with `cancel-in-progress: false`; the associated source-level regression test passed before merge. The six most recent observed `Update FPL Data` runs were successful, and the current schema-v2 snapshot remained consistent at 279 players. No artificial overlapping production dispatch was created solely for this verification. Runtime queue behaviour remains an observation item for the next ordinary scheduled run or any naturally occurring overlap; the runbook now defines the evidence and escalation criteria.
