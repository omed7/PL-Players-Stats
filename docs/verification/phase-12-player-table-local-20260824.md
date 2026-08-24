# Phase 12 local browser verification — 24 August 2026

## Initial local observation

The first local browser load transitioned to the explicit existing unavailable-data state: zero players, `Updated —`, and the visible `Try again` control. This is recorded as a data-load observation, not a player-table rendering conclusion. The next step is to inspect the browser console and request path before retrying; the existing load-error/no-results/preseason distinction must remain intact.

## Controller correction and retry

The first local error was traced to a `ReferenceError` from stale `isGK` references left in `renderTable` after extracting visibility decisions. Those references were corrected to use the utility result. Focused utility and load-order tests then passed. A subsequent reload still showed the explicit unavailable-data state, so the next check remains the console and data-source path rather than assuming table-rendering failure.

## Local cache control

A prior localhost service worker and one cache were removed before a fresh reload. The explicit unavailable-data state persisted. The console retained the earlier pre-fix `isGK` entry, so it cannot by itself establish a new controller failure after the correction. The next diagnostic is the current local data request path.

## Post-fix loader state

After the controller correction and local cache clearing, an explicit invocation of the existing loader still produced zero loaded/filtered players with `loadError: true` and no selected data source. This confirms a remaining local load path issue, not an inferred football or filter state. The current console exception is being inspected before any further code change.

## Stale local-controller diagnosis

Direct loader inspection returned a compatible schema-v2 Supabase dataset with 279 players, so the data source was healthy. Captured error output showed the historical `isGK` reference even after the repository source had been corrected. The served `script.js` contained the correction, but the active browser `renderTable` function still included the pre-fix tail, consistent with a stale localhost application-shell execution context. Verification will continue on a fresh local origin rather than treating this browser-cache artefact as a source defect.

## Fresh-origin successful verification

Serving the branch from a fresh localhost origin avoided the stale application-shell context. The compatible 279-player dataset loaded normally, the populated outfield table rendered with its expected metrics, and selecting the goalkeeper filter produced the expected compact Saves/Points/BPS/Bonus/Points-per-price table with 18 filtered players. The extraction preserved normal table state and goalkeeper column visibility.

With the goalkeeper filter active, switching to Season produced the expected Saves, Points, Clean Sheets, PPG, BPS, Bonus, and Points-per-price layout. The browser maintained 18 goalkeeper results and displayed season values without a rendering error.

Selecting the first goalkeeper row opened the existing player-detail dialog with season metrics and fixture content. Pressing `Escape` dismissed the dialog and returned focus to the normal table interaction path. The extraction retained the modal and keyboard behaviour.

The FDR heatmap opened from the freshly rendered table and returned to the filtered goalkeeper season view without error. Existing source-observed fixture presentation and the return journey remained available after the rendering extraction.

A final fresh-origin controller check confirmed 279 loaded players, 18 filtered goalkeeper rows, `loadError: false`, and the active `renderTable` function using `columnVisibility` with no remaining legacy `!isGK` table-cell reference. This completes the local browser verification evidence.

## Final automated and code review checks

The focused tests failed before implementation because the utility module and script tag were absent, then passed after implementation. The final `npm test` run passed all 18 Jest suites (90 JavaScript tests) and all 32 Python tests. `git diff --check` passed after the final documentation whitespace correction. The review confirmed this slice adds only the player-table utility, script load order, controller wiring, focused tests, and associated specification/verification evidence; it changes no fixture, schema, pipeline, authentication, account, RLS, Team ID, or service-worker behaviour.
