# Feature Specification — Google-Account FPL Team ID Sync

**Status:** Approved
**Owner:** Manus AI
**Date:** 2026-08-20
**Related issue / PR:** N/A

## 1. Outcome

A visitor who signs in with Google can keep the optional public FPL Team ID, stable watchlist element IDs, theme, and FDR display-sort preference across devices. The feature extends the existing owner-only Supabase preference foundation; it does not change the status of a Team ID from public lookup context to an identity credential.

The observable outcome is that a user who connects a public Team ID on device A and signs in can open FPL Omed on device B, sign in with the same Google account, and have the same Team ID restored. The browser will fetch a fresh, minimised squad from the existing same-origin FPL proxy when usable official data exists. Anonymous visitors retain the existing this-device-only experience.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Synchronise a valid numeric public FPL Team ID for an authenticated user. | Treating an FPL Team ID as a password, recovery code, secret, or proof of team ownership. |
| Synchronise the existing FDR display-sort mode with theme and stable-ID watchlist values. | Storing public FPL picks, manager name, league data, FPL credentials, or raw FPL API responses in Supabase. |
| One-time safe local-to-cloud migration and cloud-to-local restoration. | Email/password, SMTP, magic links, phone, additional social providers, or changes to Google OAuth. |
| Cloud-wide authenticated disconnect of the optional Team ID, with anonymous local fallback retained. | Changing the public data pipeline, FDR scoring, fixture correctness policy, or public/marketing launch posture. |
| RLS-protected database extension, browser sync adapter, tests, preview and two-account validation. | Inferring a squad, event, blank gameweek, or fixture state from absent FPL source data. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Authenticated identity | The Supabase session user ID is the only account owner key; browser input is never trusted as a user ID. | Existing Google OAuth foundation and owner-only RLS. | No |
| Cloud preference location | Extend the existing one-row-per-user `user_preferences` table with nullable `fpl_team_id` and constrained `fdr_sort_mode`. | Existing theme is already stored in that owner-only row; no separate data class is needed. | No |
| Team ID validity | Cloud and local values must be positive safe integers; the database enforces positive `integer` values. | Existing Team ID utility and public lookup contract. | No |
| Pick persistence | Persist no picks in Supabase or local Team profile. P picks remain in memory only after a successful current/next-event proxy response. | Privacy minimisation decision. | No |
| Initial conflict rule | A valid cloud Team ID and valid cloud FDR sort mode take precedence; when absent, seed them from valid local values. Watchlist values remain a stable-ID union. | Cloud is the cross-device source of truth once an account has preference data; avoids overwriting a different device’s account context. | No |
| Team refresh after restore | A restored Team ID triggers the existing same-origin proxy refresh. If official FPL picks are unavailable, retain the Team ID but leave My Squad disabled and show the existing neutral unavailable message. | Never infer squad/picks from a missing source. | No |
| Disconnect | An authenticated disconnect clears the account’s stored Team ID and local Team profile, removing squad context across that Google account’s devices. Watchlist, theme, and FDR sort stay intact. An anonymous disconnect remains local-only. | Cross-device sync request; public Team ID is optional context. | No |
| Sync failure | Keep the valid local profile and in-memory state; display a neutral account-sync status and retry only at the next user mutation/session restore. | Last-known-good preference rule. | No |

## 4. User journey and behaviour

1. An anonymous visitor connects a public FPL Team ID or adjusts existing local preferences exactly as today. The versioned local profile remains the anonymous source of truth.
2. On Google sign-in, the app reads the user’s owner-only cloud preferences and plans a deterministic merge. The cloud Team ID and FDR sort win when valid; missing cloud values are seeded from valid local values. Watchlist element IDs are unioned.
3. The app writes the merged values locally, then fetches a fresh minimised squad through `/api/fpl-team` for the effective Team ID. No existing local profile is overwritten if the proxy data is malformed or unavailable.
4. On a new signed-in device, the app restores the cloud Team ID and preferences to local state, then attempts the fresh squad refresh. My Squad is enabled only when valid fresh picks exist.
5. When a signed-in user connects or updates a Team ID, the browser saves valid local state first and then upserts the Team ID/FDR sort into the authenticated user’s `user_preferences` row.
6. When a signed-in user disconnects, the app clears the Team ID in the cloud and locally. The connected squad state is removed from memory across the account’s next device refresh; the user’s watchlist and other preferences stay untouched.
7. Signing out stops cloud writes. The current browser retains its local profile and anonymous usage remains fully functional.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| `user_preferences.fpl_team_id` | Authenticated browser mutation or local migration | Nullable positive `integer`; owner derived from `auth.uid()` through RLS. | Invalid/missing value is treated as absent; it never replaces a valid local profile. |
| `user_preferences.fdr_sort_mode` | Existing local FDR setting | Nullable/constrained to `avg` or `alpha`; valid cloud value wins during initial merge. | Invalid/missing cloud value falls back to valid local value, then default `avg`. |
| `watchlist_items.element_id` | Existing account sync | Stable positive FPL element IDs only; initial merge is a set union. | Existing validation/migration remains authoritative. |
| Team picks | Same-origin `/api/fpl-team` response | Minimise to current public pick fields in memory only; no database/local-profile picks. | Preserve Team ID context but disable My Squad if valid picks cannot be retrieved. |
| Team identity | Supabase session | No caller-supplied user ID reaches cloud queries/writes. | Reject missing session in adapter; local use continues. |
| Team ID disconnect | Signed-in user action | Set the cloud Team ID to `NULL`; clear the local Team profile and in-memory picks. | If cloud clear fails, retain local profile and report sync unavailable rather than claiming global disconnect. |
| FPL credentials | Never collected | No FPL password, cookie, login, token, manager profile, or league payload is accepted or stored. | N/A |

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| New Supabase migration | Add nullable positive `fpl_team_id` and constrained nullable `fdr_sort_mode` to `user_preferences`; no RLS policy widening. | Reuse the established owner-only preference row. | Migration inspection and two-user policy test. |
| `account_sync_utils.js` | Add pure Team ID/FDR normalisation and deterministic initial-merge planning. | Make local/cloud conflict precedence executable and reviewable. | Jest unit tests. |
| `account_sync.js` | Read/write Team ID and FDR sort with theme; clear Team ID on authenticated disconnect. | Keep session-derived ownership and preference persistence in one adapter. | Mocked Supabase adapter tests. |
| `script.js` | Apply account restore to Team ID state; route Team ID connect/refresh/disconnect and FDR sort changes through the account adapter only when signed in. | Preserve immediate local UX with best-effort authenticated sync. | Browser and existing controller seams. |
| `team_profile_utils.js` | Reuse current Team ID/FDR validation; add only a pure helper if a new non-UI contract requires it. | Avoid duplicate public-ID rules. | Jest unit tests. |
| Documentation | Update the Team ID and Google OAuth runbooks/verification record after deployment. | Record a durable cross-device privacy decision. | PR review. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | A signed-in user’s valid Team ID and FDR sort persist in owner-only cloud preferences and restore on another device. | Jest adapter tests plus two-browser/manual flow. | Test output and browser record. |
| AC-2 | A valid existing cloud Team ID wins over conflicting local Team ID during first sign-in; missing cloud values seed from local. | Pure merge tests. | Jest output. |
| AC-3 | Team picks, manager/profile data, FPL credentials, and raw FPL responses are never written to Supabase. | Code/data-contract review and mocked request tests. | PR review. |
| AC-4 | Authenticated disconnect clears only the account Team ID and local squad profile; watchlist/theme/FDR remain. | Adapter and browser tests. | Test/browser evidence. |
| AC-5 | Cloud sync failure does not delete or overwrite valid local Team ID state. | Mocked adapter/controller test. | Jest output. |
| AC-6 | A second Google account cannot see or change another account’s Team ID or FDR preference. | Two-user RLS test and policy review. | Browser evidence. |
| AC-7 | Anonymous Team ID use, valid preseason state, public data loading, and My Squad’s stable-ID matching remain correct. | Full suite and deployed browser smoke. | Test/browser evidence. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| First sign-in with local Team ID | Team ID stays device-local. | Valid local Team ID/FDR seeds missing cloud preference fields. | Unit + adapter |
| New device with cloud Team ID | No Team ID restore. | Cloud Team ID/FDR restore locally; fresh picks are fetched only through proxy. | Adapter + browser |
| Local/cloud Team ID conflict | No defined behaviour. | Valid cloud Team ID wins deterministically. | Unit |
| Signed-in disconnect | Deletes local Team profile only. | Clears cloud Team ID and local squad profile; other synced preferences stay. | Adapter + browser |
| Cloud error | No Team ID cloud request. | Local profile remains valid; neutral error is shown. | Unit |
| Second signed-in account | No cloud Team ID. | No first-account Team ID/FDR data appears. | Manual two-browser RLS |
| Preseason/unavailable proxy | Local Team ID may be absent on new device. | Team ID is retained but picks/My Squad remain unavailable without inference. | Unit + browser |

## 9. Release and observability

The database migration must run before the browser code that reads the new columns is deployed. There are no new browser secrets or environment variables. A failed migration blocks browser sync deployment; the existing anonymous local Team ID feature remains usable if the code is reverted.

The rollback is a source revert of the browser sync changes. The new nullable cloud preference values can remain safely because the prior application ignores unknown columns. To roll back a global disconnect failure, do not recreate an inferred Team ID; the user must reconnect through the public flow.

Public/marketing launch remains **on hold**.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Tests pass | Pending | |
| Browser/manual verification complete | Pending | |
| Accessibility check complete | Pending | |
| Data invariants reviewed | Pending | |
| Migration applied and RLS reviewed | Pending | |
| Deployment/release check complete | Pending | |
| Durable documentation updated | Pending | |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-20 | Sync the optional public Team ID only for authenticated Google users. | The user selected account-backed cross-device personalisation after Google OAuth activation. | Anonymous use stays device-local; no Team ID becomes an identity credential. |
| 2026-08-20 | Reuse `user_preferences` for the Team ID and FDR sort. | It is a one-row owner-only setting store already used for theme. | No separate table or duplicate RLS policy surface. |
| 2026-08-20 | Valid cloud Team ID wins on initial conflict; missing cloud value is seeded from local state. | Preserves an account’s existing cross-device context and avoids silent overwrite by an individual device. | Users can explicitly reconnect to replace the account Team ID. |
| 2026-08-20 | Do not sync FPL picks. | Picks are derived public data and can be stale; minimisation requires fresh proxy retrieval. | My Squad requires a successful current/next-event lookup after restore. |
