# Phase 14 preview smoke verification — 25 August 2026

## Deployment identity

The Phase 14 pull-request preview for [PR #74](https://github.com/omed7/PL-Players-Stats/pull/74) was ready for commit `978d3843d441a72c747e1c114e143efc6befbf5a` at:

> <https://pl-players-stats-aao7ipukm-omed7s-projects.vercel.app>

The repository test workflow completed successfully before the preview smoke.

## Hosted FDR verification

The preview loaded **279 players** and opened the populated FDR heatmap with the existing source-observed headers from GW2 through GW38. The regular average-FDR order remained available; selecting the existing Alphabetical control reordered the heatmap from ARS onward.

Opening the team selector and selecting ARS reduced the heatmap to the single ARS row while preserving the source-observed header sequence and fixture-chip rendering. The Players return action restored the ARS-filtered player table with 16 results. The browser console was empty before and after the hosted smoke.

## Result

The deployed preview confirms that the FDR view-model seam preserves FDR opening, source-observed fixture rendering, sort selection, selected-team filtering, and return navigation. Direct utility tests remain the evidence for double-gameweek preservation, unobserved-slot handling, and the no-inferred-BGW rule. No data publication, account, Team ID, fixture-source, or persistence behavior was changed.
