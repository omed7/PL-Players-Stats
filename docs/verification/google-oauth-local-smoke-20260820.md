# Google OAuth Local Smoke Check — 2026-08-20

## Scope

This check validates the safe pre-configuration state of the Google OAuth account foundation. The non-secret `accountEnabled` switch remains `false`; Google provider credentials and production redirect configuration have not yet been completed by the project owner.

| Check | Result | Evidence |
|---|---|---|
| Local page loads | Pass | `http://localhost:4173/` rendered FPL Omed. |
| Account controls remain hidden while disabled | Pass | Browser interactive-element list did not include either account sign-in or sign-out control. |
| Anonymous explorer remains usable | Pass | Existing watchlist, FDR, theme, timeframe, filter, table-sort, and pagination controls rendered. |
| Valid preseason state is preserved | Pass | Page displayed the existing “season has not started yet” state, not an account or load failure. |
| Browser console | Pass | No console output/errors were reported. |

## Limitation

Google OAuth redirect, session restoration, cross-device preference sync, sign-out/re-sign-in, and two-user RLS verification remain pending the user-controlled Google OAuth provider and Supabase URL configuration described in `docs/runbooks/supabase-auth-setup.md`.
