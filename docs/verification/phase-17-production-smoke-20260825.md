# Phase 17 production smoke verification — 25 August 2026

## Release target

The Phase 17 implementation merged through PR #76 as main commit `3881e5a`. The canonical production dashboard at `https://fpl-omed.vercel.app/` responded and loaded the current public snapshot with **310 players**.

## Production browser smoke

The production smoke opened De Cuyper from the populated table. The existing player-detail dialog rendered the default Points chart with the selected GW1 H value of `17`. Selecting the existing xG control recomputed that same chart entry to `1.47`, confirming that the merged controller consumes the pure chart model for a non-points metric. Escape dismissed the dialog and returned to the populated player table.

The existing FDR action opened the populated heatmap and its Players action returned to the table. The final production browser-console check produced no output.

## Preview note

A separate PR-preview smoke could not be completed because the deployment integration returned `403 Forbidden` for the established FPL deployment project, while the configured team exposed only an unrelated project. The predictable branch alias did not resolve, and GitHub's unauthenticated browser session did not expose the PR page. Local smoke and the passing PR CI completed before merge; this canonical production smoke is the definitive hosted browser verification.

## Result

Production verification passed for populated public data, player-detail Points and xG chart paths, Escape dismissal, FDR round trip, and final console cleanliness. No account, public Team ID, persistence, fixture/FDR, public-data, publication, or privacy behavior changed.
