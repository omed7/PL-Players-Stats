# Google OAuth Production Activation Verification — 2026-08-20

## Release record

Google-only account controls were enabled through [PR #62](https://github.com/omed7/PL-Players-Stats/pull/62). The change was intentionally limited to the non-secret `accountEnabled` release gate in `public_data_config.js`; it did not add browser credentials, SMTP, email/password, magic links, or FPL credential handling.

| Item | Verified result |
|---|---|
| Pull request | #62 merged after successful repository CI. |
| Main commit | `cb6a9e305e5c35679ce190e88e0f2af811946a9f`. |
| Canonical deployment | Vercel deployment `dpl_BhQYhaQGFpsy6DBq9p4nwji7ARyT` reached `READY`. |
| Automated tests | `npm test` passed before merge: 68 JavaScript tests and 32 Python tests. |
| Google provider | The owner enabled and saved the Google provider in the active `fpl-omed` Supabase project after resolving the initial explicit provider-disabled response. |

## Production browser verification

The canonical application at [fpl-omed.vercel.app](https://fpl-omed.vercel.app/) displayed the Google-only sign-in control. After the owner completed the Google flow, the canonical origin showed **Signed in** and exposed only the application’s Sign out action. The browser console had no output or errors.

A non-sensitive preference round trip was performed on the authenticated test account. The theme was changed temporarily from green to orange, the canonical page was reloaded, and the orange theme returned while the account remained signed in. The theme was then restored to green and confirmed after a final reload. No watchlist item, public FPL Team ID profile, provider profile data, password, token, or other credential was viewed or recorded.

## Isolation and database policy verification

The owner completed a separate-account browser check and confirmed that the second Google account behaved as expected rather than inheriting the first account’s account-scoped preference.

A bounded read-only query of policy metadata returned owner-only policies for `profiles`, `user_preferences`, and `watchlist_items`. Each policy targets the `authenticated` role and requires an authenticated `auth.uid()` equal to `user_id` for relevant reads and writes. No user rows were queried.

## Security advisor review

Supabase security advisor output did not identify an issue for the three account-owned tables. It did show two unrelated items:

| Advisory | Interpretation | Action |
|---|---|---|
| `public.fpl_sync_runs` has RLS enabled with no policy | Informational; the service-owned ingestion table intentionally has no public browser policy. | No change in this OAuth release. |
| Leaked password protection disabled | The setting applies to password authentication. FPL Omed’s enabled method is Google OAuth only, with no email/password sign-in surface. | Reconsider only if password authentication is ever introduced. |

## Ongoing posture

Google OAuth is now enabled in production. Public/marketing launch remains **on hold**. The account code continues to use only the Supabase publishable key in the browser; the Google Client Secret remains stored only in Supabase provider configuration, and the Supabase service-role key remains server-only for data publication.
