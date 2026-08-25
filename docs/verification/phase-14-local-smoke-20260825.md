# Phase 14 local smoke verification — 25 August 2026

## Automated verification

The new FDR view-model helper tests passed after implementation. The complete repository gate, `npm test`, passed with **20 JavaScript suites / 102 JavaScript tests** and **32 Python tests**. The direct helper cases cover source-observed gameweek union, first available team fixture data and primary logo retention, double-gameweek preservation, selected-team filtering, missing-slot handling, average/alphabetical ordering with stable ties, zero-fixture data, and helper script load order.

## Fresh-origin FDR smoke

A fresh local origin at `http://localhost:4184` was used to avoid stale service-worker state. The dashboard loaded **279 players** and opened the populated FDR heatmap without a console error. The heatmap showed the existing source-observed gameweek headers from GW2 through GW38 and the normal team rows with safe fixture chips.

The existing alphabetical FDR control reordered the populated rows from ARS onward. Opening the existing team selector and selecting ARS reduced the FDR heatmap to the single ARS row while retaining the full existing source-observed gameweek header. Returning to Players preserved the selected ARS filter and rendered its 16-player table without error.

## Fixture truthfulness and remaining release gate

The direct unit tests establish that absent gameweeks are not inferred, source fixture groups retain double gameweeks, and missing row slots stay absent for the existing unknown/TBC renderer. No fixture, FDR-scoring, snapshot, account, public Team ID, persistence, or publication behavior changed.

The local gate is complete. The remaining Phase 14 delivery check is a deployed pull-request preview smoke of FDR open, sort, selected-team filtering, and return navigation.
