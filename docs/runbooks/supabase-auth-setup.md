# FPL Omed — Supabase Authentication Setup

**Project:** `fpl-omed` (`ghowrpjnoraohyjpmvuo`)
**Organization:** OPM
**Region:** `eu-central-1`
**Production application URL:** `https://pl-players-stats-omed7s-projects.vercel.app/`

## Purpose

This checklist prepares Supabase for the forthcoming **passwordless email sign-in** feature. The database schema, owner-only row-level security policies, and preference tables are already in place. These steps configure only authentication delivery and safe redirect behaviour; they do **not** require an FPL password or any private FPL account access.

> **Important:** Do not place a Supabase `service_role` key in Vercel, GitHub, browser code, screenshots, or chat. The application will use a public publishable key together with the database’s row-level-security policies.

## 1. Open the correct project

1. Sign in at [Supabase Dashboard](https://supabase.com/dashboard/).
2. Open the **OPM** organization.
3. Select the project named **fpl-omed**. Confirm the project reference in the URL or Project Settings is `ghowrpjnoraohyjpmvuo`.
4. In the left navigation, open **Authentication**.

Do not make changes in another Supabase project or in the unrelated application database.

## 2. Configure safe redirect URLs

1. Open **Authentication → URL Configuration**.
2. Set **Site URL** to exactly:

   ```text
   https://pl-players-stats-omed7s-projects.vercel.app/
   ```

3. Under **Redirect URLs**, add the same URL exactly:

   ```text
   https://pl-players-stats-omed7s-projects.vercel.app/
   ```

4. Save the changes.

The Site URL is the default destination in Supabase authentication emails. Redirect URLs form an allow-list: a magic link may redirect only to a configured URL. Keep this list narrow. Do not add wildcard domains, unknown preview domains, or URLs you do not control.

| Environment | URL to allow | When to add it |
|---|---|---|
| Production | `https://pl-players-stats-omed7s-projects.vercel.app/` | Add now. |
| Local development | `http://localhost:4173/` | Add only if you will test the auth UI locally. |
| Future custom domain | The exact final HTTPS URL | Add only after the domain is attached to Vercel and working. |

## 3. Verify the email sign-in provider

1. Open **Authentication → Sign In / Providers**.
2. Open the **Email** provider.
3. Ensure email sign-in is enabled.
4. Keep passwordless email links as the intended sign-in method. Do not enable a password-based user journey for this release.
5. Keep user creation enabled. The future FPL Omed sign-in action will create an account when a new visitor requests their first sign-in link.
6. Leave social providers, phone sign-in, anonymous users, and private FPL integration out of scope for now.
7. Save only if you changed a setting.

The application will use Supabase’s `signInWithOtp` client method, which sends a one-time magic link by default. The email address is the only identity input in this phase.

## 4. Configure production SMTP before enabling public sign-in

1. Open **Authentication → Emails**.
2. Choose a production SMTP provider or mailbox that you control.
3. Enter the provider’s SMTP host, port, username, password, sender name, and sender email address exactly as supplied by that provider.
4. Use a sender identity that visitors can recognise, such as **FPL Omed**. The sending domain should be verified with the SMTP provider.
5. Save the SMTP configuration and complete any provider-side domain verification or DNS records it requests.

Use a production SMTP provider rather than relying on a development or trial email service for public sign-in. Do not paste SMTP credentials into this repository, a Vercel environment variable, browser code, or a message to me.

## 5. Keep the magic-link email template simple

1. Open **Authentication → Emails** or **Authentication → Email Templates**.
2. Select the **Magic Link** template.
3. Keep the standard confirmation-link variable, `{{ .ConfirmationURL }}`, in the sign-in link.
4. Optionally use this minimal content:

   ```html
   <h2>Sign in to FPL Omed</h2>
   <p>Use this one-time link to access your saved FPL Omed preferences.</p>
   <p><a href="{{ .ConfirmationURL }}">Sign in to FPL Omed</a></p>
   <p>If you did not request this link, you can ignore this email.</p>
   ```

5. Do not replace the standard confirmation URL with a custom `/auth/confirm` URL. The static FPL Omed application does not yet implement a custom token-exchange route.

## 6. Preserve the default security posture

Review these items before leaving the dashboard:

| Area | Required state |
|---|---|
| Database tables | Leave RLS enabled on `profiles`, `user_preferences`, and `watchlist_items`. |
| Database policies | Do not remove or broaden the owner-only policies. Each policy requires `auth.uid() = user_id`. |
| Supabase keys | Do not use or expose the `service_role` key in the browser or Vercel. |
| Auth rate limits | Do not raise email-link limits to bypass testing friction. |
| MFA | Protect your own Supabase account with MFA if it is not already enabled. |
| FPL data | Do not add or collect FPL account passwords; the optional public FPL Team ID remains a later feature. |

## 7. What to report back

After completing the dashboard setup, reply with one of the following status messages:

| If complete | Reply with |
|---|---|
| Redirect URL and SMTP are ready | `Supabase Auth is configured: redirect URL and production SMTP are ready.` |
| Redirect URL is ready but SMTP is not | `Supabase redirect URL is configured; SMTP is not ready yet.` |
| You encountered a dashboard or provider issue | Describe the page and error text, without sharing credentials. |

When redirect and SMTP configuration are ready, the next implementation step will add the accessible sign-in UI, browser-side Supabase client using only the public publishable key, local-watchlist merge, and two-user RLS verification.

## References

[1]: https://supabase.com/docs/guides/auth/auth-email-passwordless "Supabase: Passwordless email logins"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase: Row Level Security"
[3]: https://supabase.com/docs/guides/platform/going-into-prod "Supabase: Production Checklist"
