# Phase 7C Browser Verification — Staged Supabase Reader

**Date:** 2026-08-19

The local staged browser build was opened with the current published Supabase snapshot available through the public `current_fpl_snapshot` projection.

| Check | Observed result |
| --- | --- |
| Selected source | `supabase` |
| Schema version | `2` |
| Player count | `0` |
| Current Gameweek | `1` |
| Deadline | `2026-08-21T17:30:00Z` |
| Load error | `false` |
| Rendered state | `The season has not started yet. Player statistics will appear after the opening matches.` |

This proves the staged browser reader can load the public Supabase snapshot without a privileged credential and preserves the valid zero-player preseason state. The unit suite separately covers static fallback for empty, incompatible, and unavailable Supabase responses, fallback-disabled failure, and total source failure.

## Canonical production verification

The ready production deployment for merged PR #58 was opened at the canonical domain with a cache-busting query. The deployed browser reported the following state.

| Check | Observed result |
| --- | --- |
| Configured mode | `supabase-first` |
| Static fallback setting | `true` |
| Selected source | `supabase` |
| Schema version | `2` |
| Player count | `0` |
| Load error | `false` |
| Rendered state | `The season has not started yet. Player statistics will appear after the opening matches.` |

The staged Supabase reader is deployed and functioning, while the hold-launch posture and temporary static fallback remain active.
