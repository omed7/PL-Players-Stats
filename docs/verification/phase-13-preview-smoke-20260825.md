# Phase 13 pull-request preview smoke verification — 25 August 2026

## Deployment identity

The ready Vercel preview for pull request [#72](https://github.com/omed7/PL-Players-Stats/pull/72) was deployed from commit `5e6cec9f673bc6eadf829ae260bcdb1034ceeb0b` on branch `feat/player-query-state-seam`.

> Preview URL: <https://pl-players-stats-1sn58n229-omed7s-projects.vercel.app>

## Populated and no-results query states

The hosted preview loaded the populated public dashboard with **279 players** and `Page 1 of 19`. A deliberately unmatched search produced **0 players**, the unchanged “No players match the current filters.” message, and `Page 1 of 1`. Clearing the search restored the populated table.

## Goalkeeper, season, sort, and pagination paths

The goalkeeper filter returned **18 players** and the expected compact goalkeeper layout. In Season view, the established Clean Sheets and PPG columns remained visible. Sorting by Points reset the table to page 1 and ordered the leading rows Tzolakis (10), Trafford (9), Kelleher (7), and Pickford (7). Next-page navigation displayed the final three records on `Page 2 of 2`.

## Dialog and FDR journeys

Opening the final-page Lammens player detail rendered the existing season metrics and fixture content. `Escape` dismissed the dialog and returned to the filtered table. The FDR heatmap opened from that view and returned to the same goalkeeper, season, points-sorted page without error. The preview browser console remained empty after the smoke paths completed.

## Result

The deployed-preview gate is complete. The tested preview preserved the existing user-interface, data, fixture, and account-adjacent behaviour while consuming the new pure query-state and pagination utility.
