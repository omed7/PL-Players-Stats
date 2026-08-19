# Feature Specification — Phase 0: Data Contract and Test Baseline

**Status:** Approved for implementation
**Owner:** FPL Omed
**Date:** 2026-08-19
**Related issue / PR:** `N/A`

## 1. Outcome

FPL Omed must have a durable player/team identity contract and a runnable regression-test baseline before public-launch work or account persistence begins. The application must stop treating display names as durable identifiers, and the data contract must carry the source identifiers required for future watchlist migration, custom FDR, and Supabase tables.

The observable outcome is a `players.json` schema that includes FPL element/team/opponent identifiers without breaking the existing UI, plus a passing Jest suite that protects the current high-risk pure rules. Fixture statuses remain truthful: missing data is not a confirmed blank gameweek.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add stable FPL element and team identifiers to fetched records and fixtures. | Supabase schema, authentication, RLS, SMTP, or cloud preference sync. |
| Establish test discovery, shared fixtures, and initial pure-function tests. | Full fetcher unit-test coverage and workflow error hardening; those belong to Phase 1. |
| Extract a small testable fixture-status seam that distinguishes known fixtures from unknown absence. | Redesigning FDR/table UI, navigation, custom FDR, or venue timeframes. |
| Preserve compatibility with the existing browser rendering while it still reads display fields. | Altering the historical pre-season `minutes > 0` product rule. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Player identifier | Use FPL bootstrap `elements[].id` as `element_id`. | FPL API source consumed by `fpl_fetcher.py`. | No |
| Team identifier | Use FPL bootstrap `teams[].id` as `team_id`; retain short name/logo as display fields. | FPL API source consumed by `fpl_fetcher.py`. | No |
| Opponent identifier | Use `team_a`/`team_h` resolved to `opponent_id` in every fixture. | FPL element-summary fixtures source. | No |
| Blank-gameweek evidence | Treat missing fixture entries as unknown. This increment does not introduce a `BGW` visual state. | Project invariant. | No |
| Compatibility | Existing watchlist/comparison code may continue to render names temporarily, but all new persistence seams use IDs. | Incremental migration policy. | No |

## 4. User journey and behaviour

1. The scheduled fetch reads FPL bootstrap and player summary data.
2. Each player record contains display fields plus the FPL player/team IDs; each fixture contains its opponent ID.
3. The frontend renders known fixtures. When a requested gameweek has no fixture record, the fixture classifier reports `unknown`, not `blank`.
4. A developer runs `npm test` and receives a successful test result with meaningful assertions, rather than Jest’s current “No tests found” failure.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| `player.element_id` | `bootstrap-static.elements[].id` | Positive numeric stable FPL player identifier. | Fail the fetch validation if unavailable for a processed player. |
| `player.team_id` | `bootstrap-static.elements[].team` | Positive numeric FPL team identifier. | Fail the fetch validation if unavailable. |
| `fixture.opponent_id` | `element-summary.fixtures[].team_a/team_h` | Must identify the actual opponent based on `is_home`. | Fail the player fixture transformation for malformed fixture data; do not invent an ID. |
| Fixture status | Derived only from fixture records and explicit source confirmation when available. | Missing fixture data is `unknown`. | Never emit a confirmed `blank` solely from absence. |
| Display names | FPL `web_name` and team short name. | Display-only and not a persistence key. | Existing UI may use them temporarily only for visual labels. |

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `fpl_fetcher.py` | Add stable `element_id`, `team_id`, and fixture `opponent_id` fields. | Supply durable identifiers before account/persistence work. | Extracted pure record/fixture transformation helpers. |
| `script.js` | Extract fixture classification/render-input logic into a module consumable by browser code and Jest. | Prevent inferred-BGW regressions. | `fixture-status` unit tests. |
| `tests/` | Add Jest test files and representative source fixtures. | Make `npm test` a reliable quality gate. | `npm test`. |
| `package.json` | Update Jest configuration only as required for clean test discovery. | Ensure tests run in CI/local development. | `npm test`. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Generated player records include numeric `element_id` and `team_id`; generated fixture records include numeric `opponent_id`. | Fetcher transformation tests plus schema assertion. | Pending implementation. |
| AC-2 | A missing fixture record is classified as `unknown` and never as `blank`. | Fixture-status unit test. | Pending implementation. |
| AC-3 | Known single and double fixtures remain classifiable/renderable. | Fixture-status unit test. | Pending implementation. |
| AC-4 | `npm test` discovers and passes at least the data-contract and fixture-status tests. | Clean `npm ci && npm test`. | Pending implementation. |
| AC-5 | Existing public UI remains capable of rendering current and legacy snapshots without JavaScript error. | Local browser smoke test. | Pending implementation. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Stable player/team IDs | IDs are absent from output records. | IDs are present and numeric. | Unit/schema |
| Known single fixture | Existing implicit fixture object. | `known` state with one fixture. | Unit |
| Double gameweek | Existing implicit fixture object array. | `known` state with two fixtures. | Unit |
| Missing fixture data | UI can emit `BGW` based on absence. | `unknown` state; no blank claim. | Unit |
| Jest command | No test files found and exits 1. | Tests are discovered and exit 0. | Command |
| Legacy snapshot | Current `players.json` has no IDs. | UI loads safely with display values; persistence remains inactive. | Browser smoke |

## 9. Release and observability

This increment changes a committed JSON schema additively. Existing static clients may serve an older snapshot briefly; the browser must tolerate missing IDs until the new snapshot arrives. The data fetch workflow is not hardened in this increment, so deployment must not be represented as resolving pipeline-failure visibility. The rollback is a revert of the additive code/test change; retained old snapshots remain readable.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Tests pass | Pending |  |
| Browser/manual verification complete | Pending |  |
| Accessibility check complete | Not applicable to this increment |  |
| Data invariants reviewed | Pending |  |
| Deployment/release check complete | Pending |  |
| Durable documentation updated if needed | Pending |  |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-19 | Use source FPL numeric IDs for durable identity. | Names are display fields and unsafe as database keys. | Future local storage and Supabase work must reference IDs. |
| 2026-08-19 | Interpret missing fixture data as unknown. | API absence cannot prove a blank gameweek. | The current inferred-BGW output must be removed in Phase 1. |
