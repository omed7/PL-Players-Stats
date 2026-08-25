# Phase 20 — Team Profile Controls View-Model Seam

**Status:** Approved — in progress  
**Owner:** omed7  
**Date:** 25 August 2026  
**Related issue / PR:** Pending

## Outcome

Extract only the deterministic Team Profile control-presentation decisions from `syncTeamProfileUI()` into a pure UMD/CommonJS helper. The browser controller continues to own DOM lookup and mutation, public Team ID loading, account synchronization, persistence, filters, events, and status messaging.

> **Boundary:** Phase 20 prepares control data. It does not validate, fetch, store, synchronize, or disconnect a Team ID.

## Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| New DOM-free `team_profile_controls_view_utils.js` helper. | Public FPL Team ID loader/proxy, validation, response contract, or retry behavior. |
| Connected-state, explanatory-note, action-visibility, Connect/Update, and My Squad control preparation. | Profile schema, local-storage keys, migration, account writes/clears, OAuth, or Supabase/RLS. |
| A narrow `syncTeamProfileUI()` adapter that applies the helper model to current elements. | Team ID connect, refresh, disconnect, status messaging, filter semantics, or event-listener refactor. |
| Direct focused tests and a browser helper-load-order assertion. | UI redesign, responsive redesign, raw-pick processing, watchlist behavior, fixture/FDR work, or publication changes. |
| Fresh-origin local, pull-request, preview-attempt, and canonical-production verification. | FPL passwords, cookies, tokens, or any other credential collection or transmission. |

## Assumptions and durable decisions

| Topic | Decision | Evidence / owner | Open? |
|---|---|---|---|
| Team ID source | The controller supplies only its already-resolved `state.teamProfile?.teamId`; validation remains in `team_profile_utils.js` and `team_data_loader.js`. | Existing utility boundaries | No |
| Connected semantics | Preserve current behavior: a truthy supplied profile Team ID means connected. Do not add a second normalizer. | Existing `syncTeamProfileUI()` | No |
| Input handling | A disconnected model carries no replacement Team ID, preserving a visitor’s in-progress input. | Existing controller writes input only while connected | No |
| Squad state | The helper receives `hasSquad`, not raw picks or player data. | Current `state.squadElementIds.size > 0` behavior | No |
| Account context | `isSignedIn` affects only existing explanatory copy; the helper receives no session object and creates no side effect. | Existing signed-in note | No |
| Privacy | A public Team ID remains optional public lookup context, never a credential or proof of ownership. | Project invariant | No |

## User journey and behavior

1. A signed-out visitor without a connected Team ID sees **Connect**, hidden Team actions, a disabled/inactive My Squad control, and the existing device-local public-lookup note.
2. A visitor with an existing connected Team ID sees the Team ID in the field, **Update**, visible Team actions, and an enabled My Squad control only when current in-memory squad IDs are available.
3. A signed-in visitor sees the existing account-sync explanatory copy. No read, write, persistence action, or loader request occurs while building the view model.
4. My Squad active state and `aria-pressed` remain exactly aligned with the controller’s existing flag, including the disabled-plus-active edge case.

## Data contract and invariants

| Field / entity | Source | Required rule | Degraded behavior |
|---|---|---|---|
| `teamId` | Resolved controller profile | Use only to represent existing connected state and optional input text. | Missing value produces disconnected presentation. |
| `isSignedIn` | Existing account-session presence | Selects explanatory text only. | False selects device-local text. |
| `hasSquad` | `state.squadElementIds.size > 0` | Controls only My Squad disabled state. | False disables control without inferring picks. |
| `mySquadOnly` | Existing filter state | Drives active and `aria-pressed` presentation only. | False gives inactive/`"false"`. |
| Public Team ID | Existing user preference | Never becomes a password, token, cookie, or credential. | No new storage, request, or logging. |
| Player IDs/picks | Existing Team path | No raw picks, display names, or element IDs enter the helper. | No impact on My Squad filtering. |

Fixture/BGW/TBC rules, preseason classification, public-data fallback and publication, account ownership, and persistent preference behavior are untouched.

## Technical design

The new pure helper uses this single API:

```js
buildTeamProfileControlsViewModel({ teamId, isSignedIn, hasSquad, mySquadOnly })
```

It returns only primitive controller-renderable data: `isConnected`, `teamIdInputValue` (or `null`), explanatory `note`, `actionsHidden`, `connectLabel`, and `mySquad` `{ disabled, active, ariaPressed }`. It has no DOM, window, storage, fetch, account, raw-pick, or profile-normalization access.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `team_profile_controls_view_utils.js` | Add UMD/CommonJS pure helper. | Isolate deterministic state-to-presentation mapping. | Direct Jest tests. |
| `script.js` | Add one guarded accessor and adapt only `syncTeamProfileUI()`. | Preserve current controller ownership and all side effects. | Browser smoke and scope review. |
| `index.html` | Load helper before `script.js`. | Make the helper available before controller initialization. | Metadata load-order test. |
| `tests/team_profile_controls_view_utils.test.js` | Add red-first pure-model cases. | Lock local/account/squad/ARIA presentation behavior. | Focused Jest suite. |

## Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Helper is UMD/CommonJS and DOM-free, with no storage, account, loader, fetch, or raw-pick access. | Direct import and focused test/source review. | Focused Jest suite. |
| AC-2 | Signed-out disconnected output preserves existing local note, hidden actions, Connect, no input overwrite, and disabled/inactive My Squad. | Unit test. | Utility test. |
| AC-3 | Connected output preserves Team ID text, visible actions, Update, and enabled My Squad when a squad exists. | Unit test. | Utility test. |
| AC-4 | Signed-in output changes only the existing explanatory copy and causes no account/persistence side effect. | Unit test and scope review. | Utility test. |
| AC-5 | My Squad active and `aria-pressed` exactly mirror supplied state, including disabled-plus-active state. | Unit test. | Utility test. |
| AC-6 | Browser helper order is protected; Team controls, player table, FDR, dialog Escape/focus, and local public-data state remain intact. | Metadata test, full gate, fresh-origin smoke. | Local evidence. |
| AC-7 | No Team ID product, credential, account/RLS, persistence, fixture/FDR, or public-data behavior changes. | Diff review and production smoke. | Release evidence. |

## Test-first and release plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Helper module and script order | Fails because helper and ordered script tag are absent. | Direct import succeeds and helper loads before `script.js`. | Jest red/green |
| Signed-out disconnected | No direct pure contract exists. | Existing device-local note, hidden actions, Connect, no input value, disabled/inactive My Squad. | Unit |
| Connected with squad | No direct pure contract exists. | Team ID input value, visible actions, Update, enabled My Squad. | Unit |
| Connected signed-in | No direct pure contract exists. | Existing account-sync note only. | Unit |
| My Squad combinations | No direct pure contract exists. | Active/ARIA matches flag even when disabled. | Unit |
| Local regression | Existing controller works but direct seam is absent. | Fresh origin covers controls plus player dialog and FDR paths. | Browser |
| Hosted regression | No Phase 20 release exists. | PR CI, preview attempt when discoverable, and canonical production smoke after merge. | CI/browser |

Run the focused red command before implementation, then focused green tests, `npm test`, and `git diff --check`. Use a never-before-used local port for browser smoke. Create an implementation PR, wait for CI, attempt read-only preview discovery, merge under the owner’s authorization, then record canonical production verification in a separately reviewed docs-only evidence PR.

## Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User authorization |
| Focused tests fail before implementation | Confirmed on 2026-08-25: the helper module and ordered helper script were absent. | `npx jest tests/team_profile_controls_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Passed on 2026-08-25: 25 JavaScript suites / 133 tests and 32 Python tests; whitespace check passed. | `npm test` and `git diff --check` |
| Browser/manual verification complete | Fresh-origin local smoke passed on 2026-08-25. | `docs/verification/phase-20-local-smoke-20260825.md` |
| Accessibility check complete | Player-detail Escape dismissal and FDR return passed in local smoke. | Local browser smoke |
| Data invariants reviewed | Complete: the helper receives no raw picks, player IDs, credentials, session, storage, loader, or network access and makes no persistence or privacy decision. | Focused tests and scope review |
| Deployment/release check complete | Preview discovery is unavailable through the current integration; pull-request CI, merge, and canonical production smoke remain pending. | `docs/verification/phase-20-preview-smoke-20260825.md` |
| Durable documentation updated if needed | Specification and local verification record added. | This specification and local smoke record |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extract Team Profile control presentation rather than Team ID loader/profile/account behavior. | Existing Team utilities already own validation, data minimization, profile rules, and account synchronization. | Phase 20 adds testable view preparation without expanding a privacy-sensitive boundary. |
| 2026-08-25 | Preserve current truthy-profile connected semantics and no-input-overwrite behavior. | This is maintenance extraction, not a product-rule change. | Existing connected/disconnected display behavior remains unchanged. |
| 2026-08-25 | Start with direct helper and script-order red tests. | The approved delivery protocol requires focused failing evidence before implementation. | The focused command failed exactly because `team_profile_controls_view_utils.js` and its `index.html` script tag were absent. |
| 2026-08-25 | Verify only signed-out local controls in the browser; cover connected/signed-in states through pure tests. | Submitting a real Team ID or signing in is outside Phase 20’s extracted presentation boundary. | Browser smoke remains privacy-neutral while focused tests lock every helper output state. |
| 2026-08-25 | Treat canonical production smoke as the hosted verification source when preview discovery is denied. | The deployment context exposed only an unrelated project and FPL deployment listing returned 403; no verifiable preview URL was available. | Local browser smoke and PR CI form the pre-merge gate, followed by mandatory canonical production smoke. |
