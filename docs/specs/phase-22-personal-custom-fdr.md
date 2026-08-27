# Feature Specification — Personal Custom FDR

**Status:** Implemented — pending pull-request review and authenticated browser smoke  
**Owner:** omed7  
**Date:** 2026-08-27  
**Related issue / PR:** N/A

## 1. Outcome

Signed-in users need to replace the official five-level fixture difficulty display with their own reusable seven-level model, with a separate rating for facing each opponent at home and away. The FDR heatmap and player fixture chips must calculate the displayed difficulty from the opponent's venue-specific personal rating and keep those ratings synchronized through the user’s Google-authenticated account.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| A private `user_fdr_ratings` table with one row per user and opponent FPL team ID, nullable Home and Away ratings, and owner-only RLS. | Changing, recalculating, or publishing the official FPL fixture dataset. |
| A signed-in FDR editor containing one 1–7 Home control and one 1–7 Away control per current team. | Sharing ratings between users, creating public rankings, or collecting any FPL credentials. |
| Personalized FDR rendering in the heatmap and player fixture chips, including correct opponent/venue lookup. | Altering the Team ID, watchlist, or FDR sort-preference feature beyond the minimum state and account-sync integration required. |
| Account synchronization, input normalization, regression tests, and an accessible no-account/custom-rating-unavailable state. | Inferring a blank gameweek from missing fixtures or changing confirmed-BGW treatment. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Data source | The current public fixture data remains the source of fixture, opponent FPL team ID, gameweek, and venue facts. A personal rating is not a football fact. | Existing fixture payload includes `opponent_id` and `is_home`. | No |
| Product behaviour | Ratings are personal to the signed-in user and synchronize across that user’s devices. An opponent’s **Away** rating is applied when the user’s team plays that opponent at home; its **Home** rating is applied when the user’s team plays that opponent away. | Owner confirmation in this task. | No |
| Scale | A set rating is an integer from 1 (very easy) to 7 (very hard). A missing personal rating remains unavailable (`—`), not a calculated score or an inferred blank. | Approved feature scope. | No |
| Security / privacy | Each rating row uses the authenticated user ID and is readable/writable only where `user_id = auth.uid()`. The browser may use the publishable client only; no service-role key or FPL credential is introduced. | Existing account/RLS model. | No |
| Migration / compatibility | Existing `user_preferences` remains unchanged. No migration creates default ratings or changes historical source difficulty. Users without saved ratings see the unavailable custom-rating state. | Narrow compatibility decision. | No |

## 4. User journey and behaviour

1. A signed-in user opens the FDR heatmap and selects **Customize ratings**.
2. The application builds one editor row for each team observed in the validated player snapshot, with independently selectable 1–7 Home and Away ratings.
3. The user saves one or more changes. The client validates numeric team IDs and ratings, then upserts only that user’s rows through the authenticated database client.
4. The heatmap and player fixture chips use the saved values. For a home fixture versus an opponent, the opponent’s Away rating is shown; for an away fixture, the opponent’s Home rating is shown. A missing rating shows `—` and does not imply a blank fixture.
5. On another signed-in device, initial account synchronization retrieves the same rows and produces the same custom values. A signed-out visitor sees the current explicit prompt to sign in before editing; no personal FDR data is read or written.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| `user_fdr_ratings.user_id` | Authenticated Supabase session | UUID must equal `auth.uid()` under RLS. | The database denies another user’s rows; no client-side identity is trusted by itself. |
| `user_fdr_ratings.team_id` | Validated fixture/player FPL team ID | Positive integer; composite primary key with `user_id`. | Invalid or duplicate IDs are rejected before persistence. |
| `home_rating`, `away_rating` | User editor | `NULL` or integer 1–7. `Home` represents difficulty when facing the opponent at that opponent’s home ground; `Away` represents difficulty when facing that opponent away. | Invalid values are rejected; null remains `—`. |
| Upcoming fixture | Validated public source | Use source `opponent_id` and `is_home`; preserve one chip per known fixture in a double. | Unknown/delayed source slots remain `TBC`; absent data is never a BGW. |
| Auth state | Existing Google OAuth account session | Only authenticated users may load or save personal ratings. | Editor exposes an account-required state and avoids database operations. |

## 6. Technical design

The change adds a small DOM-free personal-FDR helper for rating normalization, fixture-to-opponent/venue resolution, and editor row preparation. A new owner-only Supabase table provides normalized per-team rows rather than storing an unconstrained JSON payload in `user_preferences`. The existing account-sync adapter reads and writes the rows using the actual session user ID, while the browser controller owns DOM construction, interactions, and re-rendering.

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `personal_fdr_utils.js` | Normalize ratings and changes, resolve the relevant opponent venue rating, and prepare sorted editable team rows. | Keep score and venue logic deterministic and DOM-free. | Focused unit tests for bounds, venue mapping, missing values, and duplicate entries. |
| `fdr_view_utils.js` | Accept normalized personal ratings and replace only known fixture display difficulty with the resolved 1–7 value or unavailable custom state. Preserve GW, DGW, sort, and unknown-slot behaviour. | Reuse the existing FDR view-model seam. | Existing FDR tests plus custom venue/DGW cases. |
| `account_sync_utils.js`, `account_sync.js` | Normalize cloud FDR rows; read and upsert only session-owned custom-rating rows. | Match current preference-sync architecture without changing account identity. | Mocked Supabase adapter and cloud-row normalization tests. |
| `supabase/migrations/*` | Create `user_fdr_ratings`, check 1–7 nullable ratings, enable RLS, revoke anonymous access, and define owner-only policies. | Database-enforced privacy and valid values. | Migration review and two-user RLS verification procedure. |
| `index.html`, `script.js`, `style.css` | Add keyboard-accessible personal-rating controls and account-required/empty states; update fixture chips and heatmap labels to show `1–7` or `—`. | Deliver an understandable editable table within the existing FDR view. | Browser keyboard/responsive smoke plus pure helper tests. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | The FDR editor exposes independent Home and Away controls for every current team with only clear or 1–7 selectable values. | Unit test and fresh-origin browser check. | Pending implementation. |
| AC-2 | A home fixture against opponent X uses X’s Away rating, and an away fixture against X uses X’s Home rating. | Focused pure-logic and FDR view-model tests. | Pending implementation. |
| AC-3 | Two fixtures in the same gameweek retain two independently resolved ratings; missing/delayed data remains unavailable/TBC and is not labelled BGW. | FDR and fixture regression tests. | Pending implementation. |
| AC-4 | Custom FDR rows are readable/writable only by their authenticated owner; invalid rating values cannot persist. | Migration review, mocked session adapter tests, and two-user database RLS check. | Pending implementation. |
| AC-5 | Personal ratings reload for the same signed-in user and are never read/written while signed out. | Account-sync unit tests and browser/account smoke. | Pending implementation. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Valid separate ratings | No personal-rating model exists. | Home 2 and Away 6 validate and persist as distinct values. | Unit / mocked adapter |
| Venue mapping | Source 1–5 difficulty is rendered directly. | Home fixture uses opponent Away; away fixture uses opponent Home. | Unit |
| Boundary / malformed input | No custom-input validation applies. | `0`, `8`, non-integers, invalid IDs, and duplicate changes are rejected. | Unit |
| Missing custom rating | Not applicable. | Known fixture renders an explicit unavailable custom rating; source gaps remain `TBC`, never `BGW`. | Unit / browser |
| Double gameweek | Two source fixtures are preserved. | Both fixtures remain and each resolves its own opponent/venue rating. | Unit |
| Account isolation | No custom rows. | User A cannot select, insert, update, or delete User B’s FDR rows under RLS. | Two-user database check |
| Signed-out user | No FDR editing state exists. | Edit/save controls request sign-in and issue no database mutation. | Browser / mocked adapter |

## 9. Release and observability

Apply the new Supabase migration before deploying browser code that reads the table. A migration rollback is a controlled removal of the feature code followed, only if needed, by dropping the new table and policies after exporting user-owned rows; the existing official fixture payload remains unaffected. No data refresh, secret, FPL credential, or public launch status changes are required. The standard fresh-origin smoke, CI, preview discovery attempt, and canonical-production verification remain required before merge.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Tests pass | Passed | `npm test`: 27 JavaScript suites / 148 tests and 32 Python tests on 2026-08-27. |
| Browser/manual verification complete | Partial | Fresh local signed-out FDR/editor smoke recorded in `docs/verification/phase-22-local-smoke-notes-20260827.md`; authenticated save/cross-device reload remains pending. |
| Accessibility check complete | Partial | Buttons use native controls, named groups, `aria-pressed`, `aria-expanded`, `aria-controls`, and live status text; keyboard browser smoke remains pending with an authenticated session. |
| Data invariants reviewed | Passed | FPL fixture source, unknown-slot, DGW, and personal-data invariants reviewed in this specification. |
| Database/RLS verification complete | Passed, metadata level | FPL project `ghowrpjnoraohyjpmvuo` records both migrations; the table has RLS enabled, four owner-only policies, 1–7 nullable checks, and a composite `(user_id, team_id)` key. A two-user interactive RLS probe remains pending. |
| Deployment/release check complete | Pending | Pull request #86 opened; status-check integration is unavailable to this session. |
| Durable documentation updated if needed | Completed | This specification and local smoke notes. |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-27 | Ratings are individual account-owned rows, not a shared global table. | Owner explicitly chose per-user, account-synced customization. | Migration requires owner-only RLS and sync must use the authenticated session. |
| 2026-08-27 | The stored scale is 1 (very easy) through 7 (very hard), with nullable values. | It fulfills the requested seven-level independent home/away model without fabricating values for unconfigured teams. | The FDR display must distinguish an unavailable personal rating from unknown fixture data. |
| 2026-08-27 | The personal rating belongs to the opponent/venue combination. | It gives stable, explainable venue semantics for every source fixture. | Home fixture → opponent Away; Away fixture → opponent Home. |
