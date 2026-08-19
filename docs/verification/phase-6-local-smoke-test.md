# Phase 6 Local Smoke Test

## 2026-08-19

The static local preview loaded successfully from `http://127.0.0.1:4173/` with the checked-in preseason snapshot. The page rendered the explicit preseason state: **0 players** and the message that player statistics will appear after the opening matches. The snapshot now advertises `schema_version: 2` and did not produce a visible loader failure.

A non-persistent browser-console attempt was made to invoke the player-detail modal with a synthetic schema-v2 player containing two separate Gameweek 2 match records, including a zero-minute home row and a 90-minute away row. The console action did not return the requested inspection object, so the rendered DOM still requires a visual follow-up. No project source data was changed by this browser-only attempt.

The regression suite passed before this smoke-test sequence: 11 JavaScript tests and 12 Python tests, with `git diff --check` clean.

## Schema-v2 detail-modal follow-up

The follow-up browser inspection confirmed that the synthetic schema-v2 player detail modal rendered successfully. It displayed **Last 5 Matches**, **Recent History (Last 2 Matches)**, and **Match Log**. Two records sharing Gameweek 2 remained separate: `GW2 H` with 2 points and **0 minutes**, followed by `GW2 A` with 12 points and 90 minutes. This verifies that the client-side selection is match-based, retains a completed zero-minute row, and identifies same-gameweek matches individually by venue.
