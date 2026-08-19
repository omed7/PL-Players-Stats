# Player History Venue Controls Verification

## Automated regression

The existing full suite passed after implementation: **5 JavaScript suites / 36 tests** and **20 Python tests**. The history utility regression coverage continues to verify venue-first filtering, two fixtures in a double gameweek, and retention of valid zero-minute matches.

## Local browser smoke test

A temporary schema-v2 browser fixture contained six valid completed matches: three home, three away, two fixtures in gameweek 4, and a home zero-minute match in gameweek 3. No production, local-storage, Supabase, or deployed application data was changed.

| Check | Observed result |
| --- | --- |
| Controls | `Last 5 Matches`, `Last 10 Matches`, `All Venues`, `Home`, `Away` |
| All-venue heading | `Recent History (All Venues · Last 6 Matches)` |
| Home control state | `aria-pressed="true"` after activation |
| Home-only heading | `Recent History (Home · Last 3 Matches)` |
| Home sequence | `GW1 H`, `GW3 H`, `GW4 H` |
| Zero-minute row | Retained with `0'` in the home sequence |
| Match terminology | Controls and heading use **Matches**, not gameweeks, for the selected time range |

The home sequence confirms venue filtering occurred before the selected N-match range was rendered. The gameweek-4 home fixture remained a distinct match record, consistent with the existing double-fixture behavior.
