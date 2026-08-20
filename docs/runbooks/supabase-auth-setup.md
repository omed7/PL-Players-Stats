# FPL Omed — Google OAuth Setup and Release Runbook

**Project:** `fpl-omed` (`ghowrpjnoraohyjpmvuo`)
**Organization:** OPM
**Region:** `eu-central-1`
**Canonical production application URL:** `https://fpl-omed.vercel.app/`

## Purpose

This checklist configures **Google OAuth** as FPL Omed’s first and only account method. It replaces the former email magic-link and SMTP plan: users authenticate through Google and Supabase Auth redirects them back to FPL Omed, so SMTP is **not required** for this sign-in release. [1]

The existing `profiles`, `user_preferences`, and `watchlist_items` tables already use owner-only row-level security (RLS). This runbook configures the identity provider and verifies that the browser uses only the Supabase publishable key; it never requests FPL credentials or a Google client secret.

> **Important:** Do not put the Google Client Secret or Supabase `service_role` key in Vercel, GitHub, browser code, screenshots, repository files, or chat. Enter the Google secret only in Supabase’s Google provider settings.

## 1. Open the correct Supabase project

1. Sign in at the [Supabase Dashboard](https://supabase.com/dashboard/).
2. Open the **OPM** organization.
3. Select **fpl-omed** and confirm the project reference is `ghowrpjnoraohyjpmvuo`.
4. Open **Authentication**.

Do not make changes in a different Supabase project or in an unrelated application database.

## 2. Configure Supabase’s exact production redirect boundary

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to exactly:

   ```text
   https://fpl-omed.vercel.app/
   ```

3. Under **Redirect URLs**, add the same exact URL:

   ```text
   https://fpl-omed.vercel.app/
   ```

4. Save the configuration.

`redirectTo` must appear in Supabase’s redirect allow list. Use an exact production URL rather than a broad wildcard in this held-launch production configuration. [2]

| Environment | URL to allow | When to add it |
|---|---|---|
| Production | `https://fpl-omed.vercel.app/` | Add now. |
| Local development | `http://localhost:<port>/` | Add only for an actual local OAuth test and remove it when no longer needed. |
| Vercel preview | Not enabled by default. | Add a narrow preview pattern only when a real preview OAuth test is planned. |
| Future custom domain | Exact final HTTPS URL. | Add only after the domain is attached to Vercel and working. |

## 3. Create the Google OAuth client

1. Open [Google Cloud Console](https://console.cloud.google.com/) and select or create a project that you control.
2. Open **Google Auth Platform** and complete the consent-screen **Audience**, **Data Access**, and **Branding** details appropriate for FPL Omed.
3. Under **Clients**, create an OAuth client of type **Web application**.
4. Under **Authorized JavaScript origins**, add exactly:

   ```text
   https://fpl-omed.vercel.app
   ```

5. Open the Google provider page in Supabase in a separate tab: **Authentication → Sign In / Providers → Google**. Copy the **exact callback URI shown there**.
6. Under the Google client’s **Authorized redirect URIs**, paste that exact Supabase callback URI. For this project it is expected to be:

   ```text
   https://ghowrpjnoraohyjpmvuo.supabase.co/auth/v1/callback
   ```

   If Supabase displays a different callback URI, use the value Supabase displays—do not guess or hand-edit it.

7. In Google’s **Data Access** screen, retain only the standard identity scopes needed for sign-in: `openid`, `email`, and `profile`. Do not add Google API scopes for FPL Omed’s account preferences. [1]
8. Create the client and retain the Client ID and Client Secret privately.

Google consent-screen branding is worth completing before public promotion. A custom Supabase Auth domain can improve user trust later, but it is not required to verify the current canonical-domain flow. [1]

## 4. Enable the Google provider in Supabase

1. In the Supabase **Google** provider page, enable the provider.
2. Paste the Google **Client ID** and **Client Secret** that you created in the previous section.
3. Save the provider configuration.
4. Do not enable Email/Password, magic links, phone, anonymous, Apple, GitHub, or other providers for this release.

The app uses Supabase’s browser `signInWithOAuth({ provider: "google" })` flow with the configured canonical return URL. Google owns the sign-in interaction; FPL Omed never receives or stores a Google password. [1]

## 5. Preserve the database and browser security posture

| Area | Required state |
|---|---|
| Database tables | Keep RLS enabled on `profiles`, `user_preferences`, and `watchlist_items`. |
| Database policies | Keep the owner-only policies requiring `auth.uid() = user_id`. Do not broaden them. |
| Browser configuration | Use the public Supabase URL and publishable key only. The non-secret `accountEnabled` flag remains `false` until this runbook’s verification succeeds. |
| Privileged keys | Do not add a Supabase `service_role` key to browser code, Vercel public variables, or GitHub. The GitHub Actions publication secret remains server-only. |
| Google credentials | Keep the Client Secret in Supabase’s provider setting only; never commit or share it. |
| FPL data | Do not add or collect FPL account passwords. A public FPL Team ID is optional context, not account identity. |
| Owner access | Use your own MFA on Google, Supabase, GitHub, and Vercel accounts. |

## 6. Verify the production flow before enabling account controls

Use two separate browser profiles and two separate Google accounts. Do not reuse one session for both users.

1. Confirm `accountEnabled` is still `false` in `public_data_config.js`; deploy and verify the site has no broken account control.
2. After the Google provider and redirect setup are complete, set `accountEnabled` to `true` in a reviewed pull request and deploy to the canonical site.
3. In browser profile A, select **Sign in with Google**, authenticate with Google, and confirm return to `https://fpl-omed.vercel.app/` with a signed-in label.
4. Add a player to the watchlist and choose a non-default theme. Sign out, then sign back in with the same Google account and confirm the cloud values return.
5. In browser profile B, sign in with Google account B. Confirm it does **not** show account A’s watchlist or theme.
6. In profile B, attempt to interact only through the app; confirm account A’s saved rows never appear or mutate. This is the practical two-user RLS check.
7. Sign out in both profiles. Confirm anonymous local theme/watchlist use continues and that signing out did not delete cloud preferences.
8. If a sign-in or sync check fails, set `accountEnabled` back to `false`, redeploy, and retain the diagnostics without copying user data or credentials into an issue.

Keep the public-launch/marketing posture **on hold** until the user expressly approves it, even after OAuth verification succeeds.

## 7. Activation completion record — 2026-08-20

Google OAuth provider configuration was completed in the `fpl-omed` project and the one-line browser release gate was enabled through [PR #62](https://github.com/omed7/PL-Players-Stats/pull/62). The canonical deployment reached `READY` at main commit `cb6a9e305e5c35679ce190e88e0f2af811946a9f`.

The deployed Google flow was verified through the canonical origin. The authenticated session persisted after redirect and reload; a temporary theme change completed a successful cloud preference write-and-read round trip, then was restored. A second Google account was also checked and behaved independently from the first account. The owner-only RLS policies for `profiles`, `user_preferences`, and `watchlist_items` were reviewed through bounded policy metadata without querying user records. See `docs/verification/google-oauth-production-activation-20260820.md` for the complete evidence.

Public/marketing launch remains **on hold**. Do not enable email/password, magic links, phone, anonymous, or additional social providers without a separately approved specification and verification plan.

## 8. What to report back

After completing the owner-controlled setup, reply with one of these non-sensitive status messages:

| If complete | Reply with |
|---|---|
| Google provider and redirects are configured | `Google OAuth is configured in Supabase; I am ready to test the deployed sign-in flow.` |
| Google setup is ready but client UI remains disabled | `Google OAuth is configured; accountEnabled is still false.` |
| A dashboard/provider issue occurred | Describe the page and error text, without including the Client Secret, access tokens, or user information. |

## References

[1]: https://supabase.com/docs/guides/auth/social-login/auth-google "Supabase Auth — Login with Google"
[2]: https://supabase.com/docs/guides/auth/redirect-urls "Supabase Auth — Redirect URLs"
[3]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase — Row Level Security"
