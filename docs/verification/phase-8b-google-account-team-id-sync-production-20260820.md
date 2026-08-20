# Account-Synced FPL Team ID Production Verification — 2026-08-20

## Release record

[PR #64](https://github.com/omed7/PL-Players-Stats/pull/64) introduced Google-account synchronisation for the optional public FPL Team ID and FDR sort mode. The feature was merged at main commit `a57bdf696e5afef86970cd06679b94b98e268e21` and deployed through Vercel deployment `dpl_6pMMCPeaKSLmvJ6NBaN3TtZJ53Rr`, which reached `READY`.

| Check | Result |
|---|---|
| Automated suite before merge | Passed: 72 JavaScript tests and 32 Python tests. |
| Static quality checks | `git diff --check` and `node --check` of modified browser/account modules passed. |
| Supabase migration | `20260820030000_add_synced_team_id_preferences.sql` applied successfully to `fpl-omed`. |
| Production account state | Canonical page recognised the existing Google session and displayed the authenticated Team ID sync wording. |
| Public launch posture | **Still on hold.** |

## Schema and RLS verification

The live `public.user_preferences` table retains one row per `user_id`, has RLS enabled, and now includes only the following new nullable preference fields:

| Field | Database rule | Purpose |
|---|---|---|
| `fpl_team_id` | `NULL` or positive integer | Optional public Team ID context. |
| `fdr_sort_mode` | `NULL`, `avg`, or `alpha` | User’s FDR display-sort preference. |

No public pick, FPL manager/profile/league data, raw FPL response, FPL credential, Google secret, browser token, or Supabase service-role secret is stored by this feature. The existing policies on `profiles`, `user_preferences`, and `watchlist_items` target only the `authenticated` role and require `auth.uid() = user_id` for relevant selection and mutation paths. The migration added no table and widened no RLS policy.

## Browser verification

The authenticated canonical page showed **Signed in** and the public Team ID explanation:

> “Public lookup only. Team ID and supported preferences sync with this Google account.”

The public Team ID controls remained present, while the valid zero-player preseason state remained intact. The anonymous preview displayed the existing this-device-only explanation and no browser console output. OAuth preview authentication was intentionally not attempted because the OAuth configuration restricts redirects to the canonical production origin rather than broad preview URLs.

A reversible FDR preference round trip was then performed while signed in. Alphabetical FDR was selected, the canonical page was reloaded, and Alphabetical returned as the active selection. The owner then opened a separate private-browser session, signed in with the same Google account, opened FDR, and confirmed the same Alphabetical setting restored there. Average FDR was immediately restored in the original session and visibly returned to the active state.

## Known preseason constraint

The official public FPL picks source currently returns the project’s established neutral unavailable/preseason result. Consequently, a live Team ID squad-pick restoration could not be demonstrated without inventing data. The deployed implementation retains a valid stored Team ID context, fetches fresh minimised picks only through `/api/fpl-team`, and keeps My Squad disabled until usable current/next-event picks are returned. This matches the fail-closed public-data policy.

## Completion checklist

| Requirement | Result |
|---|---|
| Existing local Team ID can seed a missing authenticated preference record | Covered by unit and adapter tests. |
| Valid cloud Team ID/FDR preference wins initial local conflict | Covered by pure merge and adapter tests. |
| Cross-device authenticated FDR preference restoration | Confirmed by owner in a separate private-browser session. |
| Owner-only RLS remains in force | Verified through bounded live policy metadata inspection. |
| Anonymous local Team ID fallback | Confirmed on READY preview. |
| Preseason/no-picks behaviour remains non-inferential | Confirmed on preview and canonical production. |
| Temporary verification preference restored | Average FDR restored after cross-device check. |

## Ongoing posture

The public Team ID remains optional public lookup context, not account identity, a recovery code, or a secret. Google OAuth remains the only sign-in method. Public/marketing launch continues to be **on hold**.
