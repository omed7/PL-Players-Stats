# Phase 6A — Schema Compatibility Verification

## Local browser verification — 2026-08-19

The local static preview loaded the current `schema_version: 2` preseason snapshot. It rendered the normal valid season-not-started state: **“The season has not started yet. Player statistics will appear after the opening matches.”** No load-error alert was shown before the incompatible-schema test.

After reloading the preview following the reset correction, the same valid schema-v2 snapshot again displayed the normal preseason state with no incompatibility alert.

The local browser was then given a non-persistent `schema_version: 99` response after the normal v2 state had loaded. The application displayed **“Player data format is temporarily incompatible. Please try again shortly.”** with its retry control. It cleared player data, set the freshness label to **“Updated —”**, and removed the prior `GW1` countdown from view. The normal preseason message was not shown as the active empty-data state.
