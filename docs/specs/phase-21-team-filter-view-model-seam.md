# Phase 21 — Team Filter View-Model and Selection Seam

**Status:** Approved — in progress  
**Owner:** omed7  
**Date:** 25 August 2026  
**Related issue / PR:** Pending

## Outcome

Extract only the deterministic Team filter item preparation, selection presentation, and selection-transition logic from `populateTeamFilter()` and `syncTeamFilterUI()` into a pure UMD/CommonJS helper. The controller continues to own safe public-data rendering, DOM operations, events, pagination, player querying, FDR re-rendering, and all lifecycle side effects.

> **Boundary:** Phase 21 prepares public Team control data and the next Team-name selection. It does not query players, render a Team button, persist a preference, or fetch FPL data.

## Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| New DOM-free `team_filter_view_utils.js` helper. | Player query/filter/sort semantics, pagination, table rows, or column visibility. |
| Team item preparation using the existing Team-name dedupe, latest-logo association, and alphabetical order rules. | Player schema, player-data loading, HTML escaping, image URL safety, or button markup. |
| Zero/one/many Team selection presentation and Team-button selection transitions. | Fixture/FDR contents, unknown/TBC/BGW rules, FDR sort logic, or fixture chips. |
| Narrow adapters in `populateTeamFilter()` and `syncTeamFilterUI()`. | Accounts, Team ID, raw picks, My Squad, watchlist, comparison, OAuth, persistence, Supabase/RLS, or publication behavior. |
| Focused direct tests, script-order assertion, fresh-origin local verification, PR, merge, production smoke, and durable evidence. | UI redesign, new filter interaction rules, telemetry, or broad event-adapter refactoring. |

## Assumptions and durable decisions

| Topic | Decision | Evidence / owner | Open? |
|---|---|---|---|
| Team identity | Existing Team **name** remains the current ephemeral filter value; it is not used for durable user data. | Current controller behavior | No |
| Item preparation | Preserve the controller’s `new Map(players.map(...))` rule: the final public player record for a repeated Team name supplies that Team’s public logo. | Existing `populateTeamFilter()` | No |
| Item order | Preserve `name.localeCompare` alphabetical ordering. | Existing controller behavior | No |
| Selection transition | Preserve select-first, remove-selected, and append-different behavior without changing selection order or normalizing input. | Existing click handler | No |
| Public-data safety | Controller retains `escapePublicHTML` and `safePublicImageURL`; helper returns raw public Team values only. | Existing render boundary | No |
| Privacy | Helper has no user data, credentials, Team ID, account, raw picks, durable element IDs, storage, network, or DOM access. | Phase boundary | No |

## User journey and behavior

1. A visitor sees alphabetical unique Team buttons from currently loaded public player data.
2. With no selection, the toggle says **Filter by Team**, no count is visible, and the toggle has no selection style.
3. Selecting the first Team yields `Team: <team>` and marks exactly that Team button selected.
4. Selecting a different Team appends it; the toggle returns to **Filter by Team** and displays `<n> selected`.
5. Selecting an already-selected Team removes it; removing the final Team restores the no-selection presentation.
6. The controller resets pagination, runs existing player filtering, and refreshes visible FDR only when applicable; the helper has no side effect.

## Data contract and invariants

| Field / entity | Source | Required rule | Degraded behavior |
|---|---|---|---|
| `players[].team` | Current public player collection | Used only to construct transient Team filter data. | Missing/invalid values retain current JavaScript collection behavior; no football fact is inferred. |
| `players[].logo` | Current public player collection | Final repeated Team record supplies the raw logo value; controller performs image safety. | Unsafe/missing rendering stays controller-owned. |
| `selectedTeams` | Existing controller state | Preserve supplied order and exact string comparisons; do not persist or normalize. | Empty array gives no-selection presentation. |
| Team names | Existing filter-state values | May remain UI labels only; never become a durable player or user identifier. | No account/persistence effect. |
| Fixtures/BGW | Existing FDR path | Not read, classified, or changed by the helper. | Unknown fixtures remain unknown/TBC. |

Preseason classification, load errors, public-data fallback, publication behavior, Google OAuth, owner RLS, FPL Team ID behavior, and stable FPL element-ID rules are untouched.

## Technical design

The helper exposes two data-only functions:

```js
buildTeamFilterViewModel({ players, selectedTeams })
// { teams: [{ name, logo, selected }], selection: { count, hasSelection, label, countLabel } }

toggleTeamFilterSelection({ selectedTeams, teamName })
// { selectedTeams }
```

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `team_filter_view_utils.js` | Add UMD/CommonJS pure helper. | Make Team control decisions directly testable. | Direct Jest tests. |
| `script.js` | Add guarded accessor and adapt only Team filter preparation, transition, and label application. | Retain browser rendering and side effects. | Browser smoke and scope review. |
| `index.html` | Load helper before `script.js`. | Guarantee browser availability before controller initialization. | Metadata load-order test. |
| `tests/team_filter_view_utils.test.js` | Add red-first tests for item preparation, presentation, and transition. | Lock exact existing behavior. | Focused Jest suite. |

## Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Helper is UMD/CommonJS, DOM-free, and has no storage, account, Team ID, raw-pick, network, player-query, or FDR access. | Direct import and source review. | Utility test. |
| AC-2 | Helper preserves existing latest-logo Team-name dedupe and `localeCompare` alphabetical item order. | Unit test. | Utility test. |
| AC-3 | Helper preserves zero/one/many Team selection labels, counts, and selected-toggle state. | Unit test. | Utility test. |
| AC-4 | Helper preserves select-first, selected-remove, and append-different transitions without mutating supplied selection. | Unit test. | Utility test. |
| AC-5 | Browser helper order is protected and only the Team control preparation/transition path is adapted. | Metadata test and diff review. | Focused suite. |
| AC-6 | Fresh-origin browser smoke selects and clears a visible Team while player detail/Escape, FDR round trip, and console stay healthy. | Browser smoke. | Local evidence. |
| AC-7 | No query semantics, account, Team ID, privacy, persistence, public-data, fixture/FDR-data, or publication behavior changes. | Diff review and production smoke. | Release evidence. |

## Test-first and release plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Helper module and script order | Fails because helper and ordered script tag are absent. | Direct import succeeds and helper loads before `script.js`. | Jest red/green |
| Team item preparation | No direct pure contract exists. | Latest-logo dedupe and alphabetical order match existing controller logic. | Unit |
| Selection presentation | No direct pure contract exists. | No/one/many labels and count behavior are exact. | Unit |
| Selection transitions | No direct pure contract exists. | First select, removal, append, ordering, and non-mutation pass. | Unit |
| Local regression | Existing controller works but direct seam is absent. | Fresh origin verifies selection/clear, dialog Escape, FDR return, and no console errors. | Browser |
| Hosted regression | No Phase 21 release exists. | PR CI, read-only preview attempt when discoverable, and canonical production smoke after merge. | CI/browser |

Run focused red tests before implementation, then focused green tests, `npm test`, and `git diff --check`. Use a never-before-used local port. Create an implementation PR, wait for CI, attempt read-only preview discovery, merge under owner authorization, then record canonical production smoke in a separate docs-only evidence PR.

## Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Scope approved | Approved by owner on 2026-08-25 | User authorization |
| Focused tests fail before implementation | Confirmed on 2026-08-25: the helper module and ordered helper script were absent. | `npx jest tests/team_filter_view_utils.test.js tests/prelaunch_metadata.test.js --runInBand` (2 failed suites) |
| Full test suite passes | Passed on 2026-08-25: 26 JavaScript suites / 140 tests and 32 Python tests; whitespace check passed. | `npm test` and `git diff --check` |
| Browser/manual verification complete | Fresh-origin local smoke passed on 2026-08-25. | `docs/verification/phase-21-local-smoke-20260825.md` |
| Accessibility check complete | Player-detail Escape dismissal and FDR return passed in local smoke. | Local browser smoke |
| Data invariants reviewed | Complete: the helper has no credentials, Team ID, account, raw-pick, durable-ID, storage, network, DOM, query, fixture, or FDR access and makes no persistence or data-classification decision. | Focused tests and scope review |
| Deployment/release check complete | Preview discovery attempted on 2026-08-25; current deployment access exposed only an unrelated project and returned 403 for the known FPL project deployment list. PR CI, merge, and canonical production smoke remain pending. | `docs/verification/phase-21-preview-smoke-20260825.md` |
| Durable documentation updated if needed | Specification and local verification record added. | This specification and local smoke record |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-25 | Extract Team filter presentation and transitions rather than filtering, rendering, or FDR behavior. | Existing player query and FDR helpers already own their data decisions; the controller retains deterministic Team-control logic. | Phase 21 creates a small testable seam without altering FPL data or user preferences. |
| 2026-08-25 | Preserve current Team-name dedupe, latest-logo, alphabetical order, and unnormalized selection behavior. | This is maintenance extraction, not a product-rule change. | Existing visible Team-filter behavior remains unchanged. |
| 2026-08-25 | Start with direct helper and script-order red tests. | The approved delivery protocol requires focused failing evidence before implementation. | The focused command failed exactly because `team_filter_view_utils.js` and its `index.html` script tag were absent. |
| 2026-08-25 | Verify public Team selection and clearing directly in the browser. | Team filtering is publicly observable and outside the sensitive Team ID/account path. | Fresh-origin smoke proved BHA selection and clear while preserving dialog/FDR paths. |
| 2026-08-25 | Do not infer or claim a preview URL when the deployment integration cannot expose the FPL project. | Read-only context exposed only an unrelated project and known FPL deployment listing returned 403. | Preview limitation is durable release evidence; canonical production smoke is required after merge. |
