# Phase 12 production smoke verification — 24 August 2026

## Populated dashboard

The merged production release loaded a populated schema-v2 dashboard with 279 players and an active data freshness label. The default outfield table rendered expected player rows, formatted metrics, safe public team/player display, durable watchlist/comparison controls, and source-observed fixture chips. This closes the initial populated-table portion of the Phase 12 production gate.

## Goalkeeper and season layouts

The production goalkeeper filter returned 18 player rows and the expected compact Saves, Points, BPS, Bonus, and Points-per-price table. With the goalkeeper filter active, switching to Season correctly displayed Clean Sheets and PPG alongside Saves, Points, BPS, Bonus, and Points-per-price. No table-rendering error was observed.

## Dialog and keyboard behaviour

Selecting a goalkeeper row opened the existing production player-detail dialog with season metrics and source-observed fixture content. Pressing `Escape` dismissed the dialog and returned to the table journey, preserving the required keyboard interaction.

## FDR round trip

The merged production FDR heatmap opened from the table and returned to the filtered goalkeeper season view without error. The Phase 12 production release gate is complete: populated data, default and goalkeeper/season table layouts, player-dialog keyboard dismissal, and the FDR return journey all succeeded.
