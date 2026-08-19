# Task 3 Browser Smoke Test

## Local verification

- **Preview URL:** `http://127.0.0.1:4174/`
- **Fixture:** A temporary schema-v2 response containing a player named `Saka` with `element_id: 101`.
- **Legacy input:** `localStorage.fpl_watchlist_v1 = ["Saka"]`, with no `fpl_watchlist_v2` key before the retry-driven fetch.

## Verified result

After the browser fetch and render cycle, the application produced the following settled state:

| Check | Observed value | Result |
| --- | --- | --- |
| Legacy key preserved | `["Saka"]` | Pass |
| New watchlist key | `[101]` | Pass |
| Watch button `data-watch` | `"101"` | Pass |
| Watch button active state | `true` | Pass |
| Player row rendered | `true` | Pass |
| Comparison button `data-cmp` | `"101"` | Pass |

This validates that the browser migrates an unambiguous legacy name watchlist all-or-nothing only after player data is loaded, persists durable numeric `element_id` values, and renders row controls with those values.

The fixture and fetch override existed only in the local browser session and were not committed or deployed.

## Comparison interaction check

After clicking the rendered comparison control for the same player, the settled browser DOM showed the button with `data-cmp="101"`, its selected label of `1`, and a visible `Saka` comparison chip. This confirms that comparison membership is keyed by the numeric element ID while the interface continues to display the player name.

The drawer-opening path was also updated to render its current watchlist contents before opening, ensuring a newly migrated list does not expose stale hidden placeholder content.
