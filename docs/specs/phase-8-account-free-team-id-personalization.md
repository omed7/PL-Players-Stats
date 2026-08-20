# Feature Specification — Account-Free FPL Team ID Personalisation

**Status:** Approved
**Owner:** Manus AI
**Date:** 2026-08-20
**Related issue / PR:** N/A

## 1. Outcome

FPL Omed will offer a **Connect FPL Team** action without collecting FPL credentials, email addresses, passwords, or recovery codes. A visitor enters their numeric public FPL Team ID; the app retrieves a minimised view of that team’s current FPL picks and stores the visitor’s favourites and supported FDR-display preferences in that browser only.

The observable outcome is that a returning visitor on the same browser sees their connected squad context and their personal FPL Omed settings without an SMTP or account flow. The app must be candid that this is not a private cloud account: clearing browser storage, changing browser/device, or using private browsing loses the local profile.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
| --- | --- |
| A numeric Team ID input, connection status, refresh, and disconnect action. | FPL password collection, FPL login automation, email, SMTP, passwords, recovery codes, or account registration. |
| A same-origin Vercel server endpoint that retrieves public FPL picks and returns a minimised, schema-checked payload. | Treating a Team ID as a secret, owner proof, or recovery credential. |
| Player-table squad highlighting and an accessible **My Squad** filter. | Durable storage of team picks, manager name, league membership, or FPL profile details. |
| One browser-local profile with a Team ID, watchlist `element_id` values, and supported FDR display state. | Cross-device synchronisation, personal-data RLS tables, or custom FDR scoring/rating controls. |
| Existing unconnected/global watchlist migration into the first local profile. | Deleting the existing static-player fallback or changing public-data ingestion. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
| --- | --- | --- | --- |
| Team identity | FPL Team ID is public lookup data only, never an authenticator or recovery secret. | User decision, 2026-08-20; official FPL entry response. | No |
| FPL source | Browser requests the same-origin `/api/fpl-team` endpoint; the endpoint reads official FPL bootstrap and picks routes. | Browser CORS check blocked direct FPL API reading; server-side request is required. | No |
| Returned team data | Return Team ID, selected event, and sanitized picks (`element`, multiplier, captain, vice-captain, bench order) only. | Privacy minimisation decision. | No |
| Persistence | One active profile is stored in localStorage on the current browser. Favourites retain FPL `element_id` values. | User selected Option A. | No |
| Profile loss | No recovery or cross-device restoration is provided in this release. | User selected Option A. | No |
| FDR preference | Persist the already-supported FDR display sort mode; a future custom FDR-scoring feature can extend the same local profile. | Existing `fdrSortMode`; scope control. | No |
| Passkeys | Deferred. Supabase passkey support is experimental and would introduce account state. | Supabase documentation, 2026-08-20. | No |

## 4. User journey and behaviour

1. A visitor opens FPL Omed in an unconnected state and sees a clearly labelled **Connect FPL Team** control explaining that the Team ID is public and data remains on this device.
2. The visitor enters a positive numeric FPL Team ID and submits. The app calls the same-origin endpoint.
3. On a valid response, the app highlights the 15 returned squad element IDs and enables an accessible **My Squad** filter. The active Team ID and local preferences persist in browser storage.
4. A visitor can refresh picks or disconnect. Disconnect clears the Team ID and in-memory squad context, but offers an explicit choice before removing their local profile settings.
5. A malformed, unknown, unavailable, or temporarily blocked FPL team response shows an accessible error without overwriting the last valid local profile.
6. Existing public player loading still distinguishes loading, error, valid preseason, and no-results states exactly as before.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
| --- | --- | --- | --- |
| `teamId` | User input | Positive safe integer; stringified only for the endpoint URL. | Reject locally with an inline validation message. |
| `event` | FPL bootstrap event metadata | Use current event when present; otherwise the next available event. | Endpoint returns an unavailable response; do not guess a gameweek. |
| `picks[].element` | FPL public picks payload | Positive integer element IDs only; deduplicate for squad filtering. | Reject malformed response; retain prior in-memory profile. |
| Pick attributes | FPL public picks payload | Expose only `element`, `position`, `multiplier`, `is_captain`, `is_vice_captain`. | Omit invalid pick and fail response if no valid picks remain. |
| Local profile | Browser localStorage | One versioned profile: Team ID, watchlist element IDs, FDR sort mode, and dashboard display settings. | Invalid profile is ignored; app starts unconnected and preserves no malformed data. |
| Watchlist identity | Existing player dataset | Persist FPL `element_id`, never player name. | Existing migration and normalization rules continue. |
| FPL credentials | Never collected | No password, cookie, or token is accepted or stored. | N/A |

## 6. Technical design

| Component | Change | Reason | Test seam |
| --- | --- | --- | --- |
| `team_profile_utils.js` | Pure validation, sanitized-pick normalisation, profile validation, and stable local key helpers. | Keep public-ID and persistence rules independently testable. | Jest unit tests. |
| `api/fpl-team.js` | Same-origin Vercel endpoint fetches FPL bootstrap and picks data, selects current/next event, and returns sanitised JSON with cache headers. | Official FPL data does not permit cross-origin browser requests from FPL Omed. | Handler tests with mocked fetch. |
| `team_data_loader.js` | Browser loader for same-origin endpoint with precise validation/error mapping. | Separate network concerns from dashboard controller. | Jest unit tests. |
| `script.js` | Add connected-team state, My Squad filter, local-profile load/save, safe migration from global watchlist, and error handling. | Deliver the smallest cohesive visitor flow. | Existing plus focused browser checks. |
| `index.html` / `style.css` | Add semantic form/status controls and squad indicators without changing data-table semantics. | Clear, accessible user journey. | Browser keyboard/accessibility check. |
| Architecture map | Mermaid map of browser-local storage, Vercel endpoint, public FPL API, and existing Supabase player data path. | Record changed trust/data boundary. | Rendered diagram review. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
| --- | --- | --- | --- |
| AC-1 | Only a positive numeric Team ID can reach the endpoint. | Jest validation test and browser form check. | Test output. |
| AC-2 | Endpoint returns only minimised pick fields and never FPL profile/manager/league data. | Handler test with representative source fixture. | Test output. |
| AC-3 | Browser persists and restores Team ID, watchlist element IDs, and FDR sort setting on the same device. | Jest profile tests and local browser reload. | Browser record. |
| AC-4 | Connected squad players are visibly identified and My Squad filters by FPL element IDs. | Browser fixture check. | Browser record. |
| AC-5 | Invalid/upstream team response does not overwrite a valid local profile. | Loader/handler test and browser check. | Test output. |
| AC-6 | No password, user email, FPL manager identity, service-role credential, or server-side user preference table is added. | Code review and request/response test. | PR review. |
| AC-7 | Existing player-data loading/error/preseason/no-results behavior remains correct. | Full suite and browser smoke. | Test output. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
| --- | --- | --- | --- |
| Valid connected team | No Team ID context. | Sanitised picks load; Team ID and local profile are persisted. | Unit + browser |
| Invalid Team ID | No dedicated validation. | Inline rejection without network call. | Unit + browser |
| Unknown/malformed FPL response | No endpoint path. | Explicit error; prior local profile remains intact. | Unit |
| Preseason/no current event | No Team ID context. | Endpoint selects authoritative next event only; never infers a blank. | Unit |
| Local-profile corruption | No profile. | Safe reset to unconnected state. | Unit |
| Returning same-device visitor | Global watchlist only. | Last local profile and `element_id` favourites restore. | Unit + browser |
| Existing public player dataset | Supabase-first reader. | Unchanged source/fallback/preseason behavior. | Full suite + browser |

## 9. Release and observability

The new `/api/fpl-team` endpoint introduces no secret and no new environment variable. It should be configured with a short public cache response for repeated read-only requests and must not log the raw FPL profile response. Browser errors should be visible to the visitor and may be logged only as non-identifying status/reason categories.

Rollback is a source revert: the existing public player reader and global local watchlist remain operational. There is no migration of Supabase tables or browser credential to reverse.

## 10. Completion record

| Check | Result | Link / evidence |
| --- | --- | --- |
| Tests pass | Pending | |
| Browser/manual verification complete | Pending | |
| Accessibility check complete | Pending | |
| Data invariants reviewed | Pending | |
| Deployment/release check complete | Pending | |
| Durable documentation updated | Pending | |

## Decision log

| Date | Decision | Rationale | Consequence |
| --- | --- | --- | --- |
| 2026-08-20 | Use account-free, this-device Team ID personalisation for initial release. | Avoid SMTP and email-account requirements while providing squad-aware personalisation and durable local favourites. | No cross-device preference sync or recovery. |
| 2026-08-20 | Do not use public Team ID as a recovery code. | It is publicly discoverable and cannot protect private preference data. | Recovery codes and passwordless accounts remain deferred. |
| 2026-08-20 | Defer passkeys. | They avoid SMTP but add account state and depend on an experimental Supabase API. | Reconsider after the account-free user journey is proven. |
