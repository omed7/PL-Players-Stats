# Feature Specification — Google OAuth Account Foundation

**Status:** Approved — implementation gated on user-controlled provider credentials and redirect configuration
**Owner:** Manus AI
**Date:** 2026-08-20
**Related issue / PR:** N/A

## 1. Outcome

FPL Omed will offer **Sign in with Google** as its first and only application-account method. A signed-in user’s theme preference and FPL `element_id`-based watchlist will synchronise across devices through Supabase Auth and the existing owner-only database tables, while anonymous visitors retain the current browser-local experience.

Google OAuth replaces the previously deferred email magic-link proposal. The initial OAuth sign-in flow does not send application email, so production SMTP is not a prerequisite. Supabase performs the provider redirect and the browser client restores the resulting authenticated session. [1] [2]

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Google-only Supabase OAuth sign-in, session restoration, accessible signed-in state, and sign-out. | Email/password, magic links, password reset, account recovery email, or SMTP configuration. |
| First-sign-in union of valid local and cloud watchlist IDs. | FPL passwords, private FPL account access, or storage of a Supabase service-role key in browser code. |
| Theme preference read/write through the existing `user_preferences` table. | Additional providers such as Apple, GitHub, or Facebook before Google is verified in production. |
| Existing owner-only RLS verification and a two-user privacy check. | Custom FDR preferences or comparison-set sync; these need their own data-contract decision. |
| An optional public FPL Team ID feature remains separate from account identity and works without sign-in. | Saving FPL Team ID squad data in Supabase during this release. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Account method | Use only Google OAuth through Supabase Auth. Do not expose email/password or email-link controls. | User decision, 2026-08-20. | No |
| SMTP | Defer SMTP. It is unnecessary for the Google sign-in path and remains necessary only for later email-based account features. | Product decision; Supabase provider flow. [1] | No |
| Google OAuth app | The project owner creates a Google **Web application** OAuth client and keeps the client secret in Supabase’s Google provider configuration, never in this repository or browser code. | Google/Supabase setup requirement. [1] | No |
| Canonical application origin | Use `https://fpl-omed.vercel.app` as the production Site URL, Google JavaScript origin, and Supabase redirect target. | Existing canonical deployment. | No |
| Provider callback | Google’s authorised redirect URI is the exact callback displayed by Supabase for project `ghowrpjnoraohyjpmvuo` (expected: `https://ghowrpjnoraohyjpmvuo.supabase.co/auth/v1/callback`). | Verify against the Supabase Google-provider page before saving Google credentials. [1] | No |
| Supabase browser key | Use only the existing publishable key. RLS enforces ownership; a service-role key never enters browser assets, Vercel public variables, or the repository. | Existing security invariant and migration. | No |
| User data ownership | The current `profiles`, `user_preferences`, and `watchlist_items` tables remain owner-only through `user_id = auth.uid()` RLS. | Applied `create_account_foundation` migration. | No |
| Watchlist identity | Persist numeric FPL `element_id`, never player names. | Project invariant. | No |
| First-sign-in merge | Keep the set union of valid local and cloud watchlist IDs. Cloud theme wins if present; otherwise the current local theme seeds the cloud row. | Existing account-foundation decision. | No |
| Account release gate | Account controls are coded **disabled by configuration** and must stay unavailable in production until Google OAuth is enabled, Google consent-screen settings are complete, the exact redirect configuration is saved, and the two-user RLS check passes. | Safe release decision. | No |

> **No implementation is permitted to collect or request an FPL password.** A public Team ID is optional context for player filtering; it is never used as an account credential or recovery mechanism.

## 4. User journey and behaviour

1. An anonymous visitor uses the explorer, local theme, and local watchlist exactly as today. The account control remains hidden or disabled until the release gate is configured.
2. Once enabled, a visitor selects **Sign in with Google**. The browser calls Supabase Auth with `provider: "google"` and a return location that is restricted to the configured canonical app origin. Supabase redirects the visitor to Google and then back to the permitted application URL. [1] [2]
3. On return, the Supabase browser client detects and persists the authenticated session. The UI changes to a non-sensitive signed-in label and exposes **Sign out**.
4. The application reads the user’s RLS-protected theme and watchlist. It merges valid local watchlist IDs with the cloud set, writes missing entries idempotently, and applies the cloud theme when one exists.
5. Subsequent watchlist and theme changes remain optimistically available locally. When authenticated, they also synchronise to only the active user’s rows. A non-destructive accessible warning appears on sync failure.
6. On sign-out, the app removes only the local authenticated session. Cloud data remains unchanged, and the user returns to anonymous local behaviour.
7. If the provider is not configured, the redirect is rejected, or synchronisation fails, the application must preserve the local watchlist and theme. It must not claim the user is signed in or expose upstream provider detail.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure / degraded behaviour |
|---|---|---|---|
| Supabase Auth session | Google OAuth through Supabase | Browser client restores session only from Supabase Auth; display only a minimal account label, never a token or provider profile data. | Continue anonymously; retain local state. |
| `profiles.user_id` | Active Supabase Auth UUID | Create lazily with an authenticated upsert; never accept a user ID supplied by UI state. | Local browsing continues. |
| `user_preferences.theme` | Existing UI theme | Read and write only through RLS. Cloud theme wins if it exists; otherwise seed it from valid local theme. | Keep local theme and surface a non-destructive sync message. |
| `watchlist_items.element_id` | Current player snapshot and local storage | Positive integer FPL element ID; first sign-in union is deduplicated and never deletes a cloud item. | Ignore invalid local IDs; preserve valid local entries for retry. |
| Browser auth config | `public_data_config.js` derivative | Contains only Supabase URL, publishable key, and boolean account-release switch; no OAuth secret, service key, or Google credential. | Account control stays unavailable. |
| OAuth redirect | Supabase URL Configuration | `redirectTo` must match a permitted redirect URL; production uses the exact canonical application URL rather than an open redirect pattern. [2] | Supabase rejects the redirect; local state remains unchanged. |
| FPL Team ID | Optional public identifier | Never treated as identity, a recovery secret, or a database owner key. Never collect FPL passwords. | Team filter remains independent of account status. |

The existing fixture, preseason, public-data, and data-pipeline invariants are unchanged. Authentication must not alter fixture classification or cause absent fixture data to be labelled as a confirmed blank gameweek.

## 6. Technical design

The application remains vanilla browser JavaScript. A small `account_auth.js` module owns the Supabase browser client, Google redirect initiation, current-session lookup, session-change subscription, and sign-out. A separate `account_sync.js` module owns RLS-backed preference and watchlist operations plus deterministic local-to-cloud merge logic. Existing UI code receives narrow callbacks/state snapshots instead of calling Supabase directly.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `public_data_config.js` | Add non-secret, disabled-by-default account client configuration: `accountEnabled`, Supabase URL, and publishable key. | Separates public data loading from intentional account rollout. | Configuration normalisation unit test. |
| `account_auth.js` | Create client, begin Google OAuth with canonical return URL, restore session, subscribe to auth-state changes, sign out. | Isolates third-party Auth SDK calls from table rendering. | Mocked client unit tests. |
| `account_sync.js` | Validate/union watchlists, lazy profile upsert, theme read/write, and owner-scoped database calls. | Keeps stable IDs and cloud/local merge semantics testable. | Pure merge tests plus mocked data-client tests. |
| `index.html` | Load the pinned Supabase browser SDK before account modules; add an accessible account-control region. | Provides a clear yet non-blocking account path. | Browser keyboard/state check. |
| `script.js` | Integrate account state with existing local watchlist/theme operations without removing anonymous fallback. | Delivers cross-device sync while preserving anonymous use. | Focused UI tests and manual browser scenarios. |
| `docs/runbooks/` | Replace the magic-link/SMTP workflow with an operator-owned Google OAuth setup and release checklist. | Makes the configuration reproducible without sharing credentials. | Checklist review and deployed browser test. |

No database migration is required for the Google provider itself: the existing schema uses provider-neutral Supabase Auth UUIDs. Any later schema extension for FDR preferences or persisted public Team ID settings requires a separately approved specification and migration.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Email/password and magic-link controls do not exist. The only account initiation action is **Sign in with Google** when the account release switch is enabled. | Source review and browser check. | Test output and deployed UI note. |
| AC-2 | The app begins Google OAuth only with an exact canonical `redirectTo`; no OAuth secret, service-role key, FPL password field, or FPL credential handling exists in client code. | Unit test and secret review. | Test output and repository search. |
| AC-3 | An unauthenticated visitor keeps working with local theme and watchlist while account sync is disabled, unavailable, or fails. | Browser/manual failure check. | State-transition record. |
| AC-4 | First authenticated sync produces the union of valid local/cloud FPL element IDs, without duplicates or deletion of cloud rows. | Unit and mocked adapter tests. | Test output. |
| AC-5 | Existing cloud theme wins; otherwise a valid local theme is saved as the initial cloud preference. | Unit and mocked adapter tests. | Test output. |
| AC-6 | Sign-out removes the authenticated UI/session but does not delete cloud data or anonymous local state. | Unit and browser check. | State-transition record. |
| AC-7 | Two different authenticated Google users cannot read or mutate each other’s rows in `profiles`, `user_preferences`, or `watchlist_items`. | Manual two-user RLS verification after provider setup. | Release runbook record. |
| AC-8 | Production UI remains disabled until provider and redirect configuration are verified. | Configuration test and deployed check. | Deployment note. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Account release disabled | No account implementation. | No broken auth initiation; anonymous behaviour remains available. | Unit + browser |
| Google OAuth initiation | N/A. | Calls `signInWithOAuth` with `google` and an exact permitted canonical return URL. | Unit |
| OAuth session restored | N/A. | UI enters signed-in state and starts sync only for an active session. | Mocked client unit |
| First sign-in with local IDs | N/A. | Valid IDs merge with cloud IDs by set union; invalid values are ignored. | Unit |
| Existing cloud theme | N/A. | Cloud theme applies instead of overwriting it with local state. | Unit |
| Sync failure | N/A. | Local state is preserved; accessible non-sensitive message appears. | Unit + browser |
| Sign-out | N/A. | Session/UI is cleared; no cloud deletion occurs. | Unit + browser |
| User A attempts User B operations | Existing tables provisioned. | RLS denies every cross-user select, insert, update, and delete attempt. | Manual two-user release check |

The final automated command is `npm test`. Before merging, run the browser check against the Vercel preview with account sync disabled; after the owner completes provider setup, repeat it on production with Google sign-in, a second browser profile, sign-out, and a two-user RLS check.

## 9. Release and observability

Before turning `accountEnabled` on in the canonical production deployment, the project owner must complete the following user-controlled setup without sharing the Google client secret in chat, code, or repository history:

1. In Google Cloud’s Google Auth Platform, create a **Web application** OAuth client. Set its authorised JavaScript origin to `https://fpl-omed.vercel.app` and copy the **exact** Supabase callback URI displayed in the provider page into Google’s authorised redirect URIs. Configure only `openid`, `email`, and `profile` scopes. [1]
2. In Supabase `fpl-omed`, set the Site URL to `https://fpl-omed.vercel.app/`, add that exact URL to the redirect allow list, enable the Google provider, and enter the Google Client ID and Client Secret in the Supabase Dashboard. [1] [2]
3. Verify the Google consent screen’s audience and branding. A custom Supabase Auth domain is beneficial but is not a prerequisite for this held launch. [1]
4. Change the non-secret `accountEnabled` switch only after a successful canonical sign-in, sign-out/re-sign-in, local-to-cloud merge, second-browser sync, and two-user RLS check.

Rollback consists of setting `accountEnabled` to `false` and redeploying. This hides/disables account initiation while leaving anonymous persistence and existing cloud rows intact. Marketing/public-launch posture remains **on hold** until the user explicitly approves it.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| OAuth-first account decision recorded | Complete | This specification |
| Google client created and configured | Pending user-controlled step | Google Auth Platform and Supabase provider pages |
| Supabase URL/redirect configuration verified | Pending user-controlled step | Supabase Auth URL Configuration |
| Browser modules and UI implemented | Pending | Pull request evidence |
| Automated tests pass | Pending | `npm test` |
| Two-user RLS check passes | Pending provider setup | Release runbook record |
| Deployed Google OAuth verification | Pending provider setup | Canonical deployment note |
| Hold-launch posture preserved | Required | Release review |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-20 | Use Google OAuth as the first and only account method. | It provides a familiar cross-device account without the production SMTP requirement of email-based password recovery or magic links. | Browser account UI and Supabase Auth configuration pivot from email to Google. |
| 2026-08-20 | Keep account controls disabled until configuration and privacy checks pass. | A broken social-login button is worse than no account feature, and a release gate prevents public claims before real verification. | OAuth code may merge safely before provider credentials are configured. |
| 2026-08-20 | Keep public FPL Team ID independent and optional. | Team ID is public context, not a secure identity or recovery credential. | The existing Team ID work remains a later, separate PR. |

## References

[1]: https://supabase.com/docs/guides/auth/social-login/auth-google "Supabase Auth — Login with Google"
[2]: https://supabase.com/docs/guides/auth/redirect-urls "Supabase Auth — Redirect URLs"
