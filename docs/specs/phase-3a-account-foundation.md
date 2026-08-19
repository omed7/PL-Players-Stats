# Feature Specification — Phase 3A: Account Foundation and Preference Sync

**Status:** Foundation provisioned — client authentication implementation pending email configuration
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

FPL Omed will let a visitor create or access an application account using a passwordless email link, then keep their theme preference and player watchlist available across devices. Existing anonymous visitors must retain their local watchlist when they first authenticate. The observable proof of success is that two distinct authenticated users can each save and retrieve only their own preferences and `element_id`-based watchlist entries.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Supabase Auth with a passwordless email-link flow. | FPL passwords, credentials, or private FPL account access. |
| `profiles`, `user_preferences`, and `watchlist_items` user-owned data. | Custom FDR ratings, comparison sets, notifications, and collaboration. |
| Synchronisation of theme preference and watchlist entries keyed by FPL `element_id`. | FPL Team ID squad data or team-context UI; that is Phase 3C. |
| Deterministic first-sign-in merge between browser-local and cloud watchlists. | A framework migration, backend service, or storage of a Supabase service-role key. |
| RLS policies, migrations, authenticated error states, and two-user privacy checks. | Public launch of magic links before production SMTP, redirect URLs, and deliverability are verified. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Authentication method | Use application-native passwordless email links. The product never requests FPL credentials. | FPL engineering invariant; implementation owner: FPL Omed. | No |
| Database service | Use a user-owned Supabase project with Auth and Postgres. | Roadmap Phase 3; user must connect or provide the project. | Yes |
| User identifier | Every persisted user-owned row uses Supabase Auth UUID `user_id`. | FPL engineering invariant. | No |
| Player identity | Watchlist entries use numeric FPL `element_id`; display names are never persisted as keys. | Phase 0 data contract. | No |
| Watchlist merge | At first successful sign-in, preserve the **union** of valid local and cloud `element_id` values. Deduplicate by `(user_id, element_id)`. | Recommended roadmap default. | No |
| Theme merge | If the account already has a saved theme, cloud wins. Otherwise, the current local theme is saved as the initial cloud preference. | Preserves cross-device choice without discarding a new user’s local setting. | No |
| Email delivery | Configure production SMTP and the exact production redirect URL before enabling public magic links. | Required release gate. | Yes |
| Public FPL Team ID | Keep optional Team ID storage and validation out of 3A; add it only in Phase 3C. | Limits the first privacy-sensitive release. | No |
| Data lifecycle | Define export/deletion behaviour in Phase 3B before collecting optional Team IDs. | Roadmap Phase 3B. | No |

> **Implementation must not begin until the Supabase project is connected and production email delivery/redirect configuration are confirmed.** These settings determine user privacy, authentication reliability, and release behaviour.

## 4. User journey and behaviour

1. An anonymous visitor uses the player explorer exactly as today. Their theme and watchlist continue to live locally until they choose to sign in.
2. The visitor selects **Sign in**, enters an email address, and sees a neutral confirmation state. The interface never reveals whether the address already has an account.
3. After the authenticated redirect completes, the app reads the user’s preference row and watchlist entries under the authenticated session.
4. The app merges local watchlist IDs into the user’s cloud watchlist using set union. If no cloud theme exists, it persists the local theme; otherwise it applies the cloud theme.
5. Subsequent star/unstar and theme changes update local UI optimistically and synchronise only the current user’s database rows. A clear non-destructive warning appears if syncing fails.
6. On sign-out, cloud data remains intact, the visitor returns to anonymous local behaviour, and a later sign-in restores the authenticated preference state.
7. If email delivery, redirect, authentication, or Supabase access fails, the app keeps anonymous local state unchanged and offers a retry path. It does not delete or overwrite local watchlist data.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure / degraded behaviour |
|---|---|---|---|
| `auth.users.id` / `user_id` | Supabase Auth | UUID owner key on every user-owned table; database policy checks `auth.uid() = user_id`. | Deny access; never fall back to another user’s data. |
| `profiles.user_id` | Authenticated session | Primary key references the Auth user. The initial profile is created lazily or by an approved database trigger. | Do not block local player exploration. |
| `user_preferences.theme` | UI setting | Constrained to the app’s declared themes; one row per user. | Retain current local theme and show a sync warning. |
| `watchlist_items.element_id` | FPL `players.json` contract | Positive integer FPL element ID. Composite primary key `(user_id, element_id)` prevents duplicates. | Ignore invalid local values during migration and log a non-sensitive client warning. |
| `watchlist_items.user_id` | Authenticated session | Must equal `auth.uid()` in every select, insert, update, and delete policy. | Database rejects the request. |
| Local watchlist | Browser local storage | Merge only numeric IDs that occur in the current valid player snapshot when possible; set union never removes cloud entries. | Preserve local state until a later successful sync. |
| Supabase anonymous key | Public app configuration | May be client-visible; it is not privileged. RLS, not key secrecy, enforces ownership. | Never include a service-role key in browser assets or Vercel public configuration. |

The fixture, preseason, and FPL data-pipeline invariants remain unchanged. Account state must not modify FPL fixture classification or cause an absent fixture to be presented as a confirmed blank gameweek.

## 6. Technical design

The initial account release remains a static-browser application. It uses the Supabase browser client with the public project URL and anonymous key, authenticated sessions, and direct database requests protected by RLS. No server-side proxy is needed for user-owned preferences, and no privileged credential is placed in the application.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `supabase/migrations/` | Add versioned SQL for user-owned tables, constraints, RLS enablement, and policies. | Schema and privacy are reviewed as code. | Two-user SQL/API integration test. |
| Browser auth adapter | Add a small module for session retrieval, magic-link initiation, sign-out, and auth-state changes. | Isolates third-party API use from existing table rendering. | Mocked client unit tests and browser flow. |
| Preference adapter | Read/write theme and watchlist items using `user_id` derived only from the active session. | Keeps persistence separate from UI and local storage. | Pure merge tests plus Supabase integration tests. |
| Watchlist migration helper | Validate and union local/cloud FPL element IDs on first authenticated sync. | Prevents existing visitors from losing saved players. | Unit tests for empty, overlap, invalid, and cross-device cases. |
| Header/account UI | Add sign-in, pending, signed-in, error, and sign-out states with accessible names and focus behaviour. | Makes auth status understandable without blocking anonymous use. | Keyboard and browser checks. |
| Deployment configuration | Add the production redirect URL and public Supabase app configuration only after Supabase setup is complete. | Prevents broken public magic links. | Deployed email-link test. |

### Proposed database schema

| Table | Columns | Keys and constraints |
|---|---|---|
| `profiles` | `user_id uuid`, `created_at timestamptz`, `updated_at timestamptz` | `user_id` primary key and foreign key to `auth.users(id)` with cascade delete. |
| `user_preferences` | `user_id uuid`, `theme text`, `updated_at timestamptz` | `user_id` primary key; `theme` check constrained to supported application themes. |
| `watchlist_items` | `user_id uuid`, `element_id integer`, `created_at timestamptz` | Composite primary key `(user_id, element_id)`; `element_id > 0`; owner foreign key with cascade delete. |

All three tables are user-owned. Each has RLS enabled and equivalent owner-only `SELECT`, `INSERT`, `UPDATE`, and `DELETE` policies using `auth.uid() = user_id`. Any SQL migration must fail closed: there must be no period in which a table exists without RLS and explicit ownership policies.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | An unauthenticated visitor can use the player explorer, local watchlist, and theme without account setup. | Browser check. | Screenshot and state notes. |
| AC-2 | A visitor can request a magic link without revealing account existence and can authenticate through the production redirect URL. | Deployed email-link test using production SMTP. | Delivery and redirect record. |
| AC-3 | First sign-in merges local and cloud watchlists as the union of valid `element_id` values with no duplicates. | Unit plus authenticated integration test. | Test output. |
| AC-4 | An existing cloud theme takes precedence over local theme; a new user’s local theme is persisted when no cloud preference exists. | Unit and browser test. | Test output. |
| AC-5 | User A cannot read, insert, modify, or delete User B’s rows in any user-owned table. | Two-user Supabase RLS integration test. | API/SQL test output. |
| AC-6 | Sign-out clears authenticated UI state but does not delete cloud preferences or overwrite anonymous local state. | Browser test. | State-transition record. |
| AC-7 | Authentication or synchronisation failure leaves the visitor’s local watchlist intact and displays a retryable, accessible message. | Browser failure simulation. | Screenshot and manual check. |
| AC-8 | No FPL password, Supabase service-role key, or other privileged secret exists in browser assets, repository history, or Vercel public configuration. | Repository secret review and deployment configuration check. | Review output. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| New visitor signs in with local watchlist | No account capability. | Valid local IDs persist as one deduplicated cloud watchlist. | Unit + browser + integration |
| Existing user signs in on a second device | No preference sync. | Cloud watchlist and saved cloud theme load without loss. | Browser + integration |
| Overlapping local/cloud entries | N/A. | Union contains each `element_id` once. | Unit |
| Invalid local value | N/A. | Invalid entry is ignored; valid local and cloud rows remain. | Unit |
| User A requests User B data | No database. | RLS denies every attempted table operation. | Two-user integration |
| Magic-link delivery failure | No auth UI. | Local data remains, no account claim is made, retry is offered. | Browser/manual |
| Sign-out then re-sign-in | No auth UI. | Cloud preferences remain recoverable and only the signed-in user’s data returns. | Browser + integration |

Before implementation, write failing tests for watchlist union and theme migration. Once Supabase is connected, add an automated two-user integration script that authenticates two disposable test users and verifies every RLS policy against actual database responses.

## 9. Release and observability

The implementation requires a user-owned Supabase project, configured Auth redirect URL for `https://pl-players-stats-omed7s-projects.vercel.app/`, and verified production SMTP delivery. The app may continue to use browser-local preferences during rollout; the account UI must remain disabled or hidden until those conditions and the two-user RLS test pass.

The release check includes a deployed magic-link flow, redirect handling, first-sign-in migration, sign-out/re-sign-in, a two-user RLS run, keyboard interaction with account controls, and a review that no privileged secret is included in the static Vercel deployment. Rollback consists of hiding the account UI and retaining all local preference behaviour; database rows remain intact unless the user explicitly initiates a later Phase 3B deletion flow.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Account specification reviewed | Draft complete | This document |
| Supabase project connected | Complete | `fpl-omed` (`ghowrpjnoraohyjpmvuo`), OPM, `eu-central-1` |
| Production SMTP configured | Pending | Authentication email configuration is still required |
| Migrations and RLS applied | Complete | `create_account_foundation`; security advisor returned no findings |
| Two-user RLS integration passes | Pending | Requires two authenticated test users after Auth/email setup |
| Browser/account checks complete | Pending | Browser verification record |
| Deployed email-link verification complete | Pending | Production delivery record |
| Durable documentation updated | Pending | ADR/spec update if needed |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-19 | Use FPL `element_id` for persisted watchlist rows. | Names can change and are not durable identifiers. | Player display names remain display-only. |
| 2026-08-19 | Use set union for first-sign-in watchlist migration. | Existing local user choices must not be lost. | Server inserts must be idempotent. |
| 2026-08-19 | Keep Custom FDR and FPL Team ID outside 3A. | The first account release must prove auth, RLS, and preference sync with minimum scope. | Those features remain separate future increments. |
| 2026-08-19 | Require production SMTP and deployed-link verification before public magic links. | Authentication reliability is a user-facing privacy and access requirement. | Client implementation remains gated until Auth configuration is available. |
| 2026-08-19 | Create the dedicated `fpl-omed` Supabase project in OPM, `eu-central-1`. | Isolates FPL Omed user data while retaining the approved organization boundary. | The owner-only preference schema is now provisioned; client auth is the next gated increment. |
