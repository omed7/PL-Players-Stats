# Accessibility Baseline Browser Smoke Test

## Local verification fixture

- **Preview URL:** `http://127.0.0.1:4174/`
- **Fixture:** A temporary schema-v2 response containing `Saka` with `element_id: 101`.
- **Scope:** The override existed only in the local browser session and was not committed or deployed.

## Verified static and rendered semantics

| Check | Observed value | Result |
| --- | --- | --- |
| Player row rendered | `true` | Pass |
| Watchlist control label | `Remove Saka from watchlist` | Pass |
| Watchlist control state | `aria-pressed="true"` | Pass |
| Comparison control label | `Add Saka to comparison` | Pass |
| Sort control | Native `BUTTON` within the `xG` header | Pass |
| Default sort state | `aria-sort="descending"` on `xG` | Pass |
| Watchlist container | `role="dialog"` | Pass |

## Keyboard and focus checks

Pending interaction verification after implementation.

## Focus-containment evidence

Opening the watchlist from its header trigger set `aria-hidden="false"` on the dialog and moved focus to `#btn-wl-close`. A real browser Tab keypress kept focus within `#wl-drawer`; in the populated fixture state it advanced to the dynamically rendered remove control, which is an expected intermediate focusable element. The remove control was subsequently given the explicit name `Remove Saka from watchlist`.

A second real Tab keypress from the populated drawer’s final remove control wrapped focus to `#btn-wl-only`, confirming the active focus order stayed inside the dialog. A real Escape keypress then produced `aria-hidden="true"` on the drawer, hid the backdrop, and restored focus to `#btn-wl-open`.

## Keyboard sorting evidence

The native `xG` sort button received focus and was activated with a real Enter keypress. The sort indicator changed from `▼` to `▲`, `#col-xg` changed from `aria-sort="descending"` to `aria-sort="ascending"`, the inactive points column exposed `aria-sort="none"`, and focus remained on the `xG` sort control.

## Player-detail dialog evidence

Opening the player detail from the rendered row exposed a `role="dialog"` / `aria-modal="true"` interaction and moved focus to `#btn-pd-close`. A real Escape keypress hid the overlay and restored focus to the original player-table `TR`.

## Comparison dialog evidence

A second temporary in-memory player was added only to the local browser fixture so the existing two-player comparison condition could be met. Opening comparison exposed a `role="dialog"` / `aria-modal="true"` interaction, selected two element-ID-backed players, and moved focus to `#btn-cmp-modal-close`. A real Escape keypress hid the overlay and restored focus to `#btn-cmp-open`.

All keyboard and focus tests used temporary local browser state only; no production data, local-storage schema, Supabase data, or deployed application data was modified.

## Closed-drawer safeguard

After reloading the final local build, the closed watchlist drawer reported `aria-hidden="true"` and `inert=true`. Its descendants remain in the DOM for rendering, but the inert container excludes them from keyboard navigation until the drawer is opened.
