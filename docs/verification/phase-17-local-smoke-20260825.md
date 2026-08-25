# Phase 17 local smoke verification — 25 August 2026

## Local origin

The Phase 17 branch was tested on a fresh local origin at `http://localhost:4195`, avoiding any stale service-worker context. The dashboard loaded the current public snapshot with **310 players** and no browser-console output.

## Player-detail chart verification

Opening De Cuyper from the populated player table opened the existing accessible player-detail dialog. The default Points chart rendered the selected GW1 H bar with `17`; selecting the existing xG metric recomputed the same chart position to `1.47`, confirming the controller renders the utility-provided chart model for an active non-points metric. The dialog dismissed through Escape and returned to the populated table.

## Navigation regression

The existing FDR action opened the populated source-observed heatmap and the Players return action restored the player table. No account, Team ID, data-publication, fixture/FDR classification, or privacy path was changed.

## Result

The fresh-origin local smoke passed the changed player-detail chart path, metric switching, Escape dismissal, FDR round trip, and final console check. Direct utility tests remain the evidence for points/minutes/generic thresholds, order preservation, zero-floor behavior, and malformed numeric input.
