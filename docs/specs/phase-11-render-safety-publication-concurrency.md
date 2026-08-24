# Phase 11 — Render-Safety and Publication-Concurrency Hardening

**Status:** Approved  
**Owner:** omed7  
**Date:** 24 August 2026  
**Related issue / PR:** N/A

## 1. Outcome

The public dashboard consumes player, team, fixture, history, and logo fields from a published public-data snapshot. This slice ensures those externally supplied display values cannot change HTML structure, executable attributes, or image schemes when they reach existing HTML-template renderers. It also serializes the data-publication workflow so a manual, scheduled, or fetcher-triggered run cannot overlap a second snapshot write.

The observable outcome is that hostile text renders as literal text, unsafe image schemes are omitted, ordinary live FPL data continues to render unchanged, and GitHub Actions queues rather than cancels or overlaps publication runs.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Add a small UMD render-safety utility for HTML text encoding, HTTPS image URLs, and recognized position class tokens. | A framework migration, template-engine adoption, or full controller rewrite. |
| Apply the utility at public-data HTML template boundaries: fixtures/FDR, watchlist, comparison, player details, team filter, and player table. | Sanitizing authored static markup, account/auth flows, or general-purpose rich HTML. |
| Add focused unit tests for hostile text, unsafe image schemes, and recognized position tokens. | A change to the player/fixture source schema, Supabase data contract, or FPL identity model. |
| Add a non-cancelling global concurrency group to `update_data.yml`. | Changing the update schedule, fetcher logic, Supabase RPC, or data-publication credentials. |
| Record the completed production smoke and publication-health observation. | Treating one green workflow as proof of every failure mode; existing fetcher failure tests remain required. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Public-data trust boundary | Any displayed string or image URL in the public snapshot is treated as untrusted at an HTML-template boundary, even though normal production data originates from the FPL pipeline. | Security hardening decision. | No |
| Text rendering | Interpolated public strings are HTML-escaped before insertion into element text, attributes, SVG text, titles, and aria labels. | P2 scope. | No |
| Image policy | Rendered snapshot image URLs accept only valid absolute `https:` URLs; malformed, relative, `data:`, and `javascript:` values render as an empty source. | Prevents non-HTTPS/unsafe scheme injection without introducing a new third-party allowlist. | No |
| CSS position class | Only `GK`, `DEF`, `MID`, and `FWD` are used as dynamic position class suffixes; all other values use `UNK`. | Existing supported position model. | No |
| Publication concurrency | All `update_data.yml` runs share `fpl-data-publication`; `cancel-in-progress: false` queues later runs rather than discarding a running validated publication. | The workflow writes the same public snapshot and `players.json`. | No |
| Data correctness | Fixture data remains source-observed; missing fixtures remain unknown and no `BGW` is inferred. | Existing project invariant. | No |

## 4. User journey and behaviour

1. The public-data reader loads a compatible snapshot and passes player and fixture records to the existing dashboard controller.
2. A normal player, team, fixture, history label, or logo renders with the same visible text, control labels, image, fixture state, and statistics as before.
3. If a snapshot field contains markup-like text, it is displayed literally rather than creating DOM elements or attributes.
4. If a snapshot image URL is malformed or uses a non-HTTPS scheme, the corresponding image has an empty `src` rather than loading the supplied scheme.
5. When a scheduled or manual publication starts while another publication is running, GitHub Actions queues the later run and allows the current validation/publish/commit sequence to finish.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure / degraded behavior |
|---|---|---|---|
| Player/team/opponent text | Public snapshot | Must be text-encoded at HTML, attribute, and SVG-template boundaries. | Literal encoded display; no generated markup. |
| Logo URL | Public snapshot | Must be an absolute `https:` URL before image-template insertion. | Empty source; the dashboard remains functional. |
| Player position | Public snapshot | Dynamic CSS suffix is limited to `GK`, `DEF`, `MID`, or `FWD`; displayed label is still encoded. | Unknown position receives `UNK` class suffix. |
| Fixture status | Existing fixture utility | Known fixtures render; absent fixture records remain unknown/TBC. | No inferred blank gameweek. |
| Publication run | GitHub Actions workflow | All output-writing runs use one non-cancelling concurrency group. | Later trigger is queued, preserving the running last-known-good publication. |

No user data, FPL password handling, Team ID behavior, RLS policy, credential, Supabase publication RPC, or public player-data schema changes in this slice.

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `render_utils.js` | Add UMD functions `escapeHTML`, `safeImageURL`, and `safePositionClass`. | Keeps security-sensitive transformation rules small, pure, and reusable by browser code and Jest. | Unit tests with hostile and valid inputs. |
| `index.html` | Load `render_utils.js` before `script.js`. | Makes the helper available before first public-data render. | Metadata assertion. |
| `script.js` | Wrap public snapshot strings, image URLs, and position-class tokens before existing `innerHTML`/SVG template use. Static HTML and calculated numeric display remain unchanged. | Closes existing template-interpolation boundary without unrelated rendering refactors. | Unit tests of helper plus local/prod browser smoke. |
| `.github/workflows/update_data.yml` | Add a root-level `concurrency` group named `fpl-data-publication` with `cancel-in-progress: false`. | Serializes snapshot writes from schedule, dispatch, and fetcher-triggered runs. | Source-level workflow-policy test. |
| `tests/` | Add render utility and workflow policy regression tests. | Enforces the P2 decision in CI. | `npm test`. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Hostile text is encoded for text and attribute contexts. | Unit test. | `tests/render_utils.test.js` |
| AC-2 | Valid HTTPS images remain usable; non-HTTPS, malformed, and relative images yield an empty source. | Unit test. | `tests/render_utils.test.js` |
| AC-3 | Only supported position tokens can become CSS class suffixes. | Unit test. | `tests/render_utils.test.js` |
| AC-4 | The browser loads render utilities before the controller. | Metadata test. | `tests/prelaunch_metadata.test.js` |
| AC-5 | Public-data HTML template sinks use the utility for external player, team, fixture, history-label, and logo values. | Source review plus browser smoke. | Diff review and verification record. |
| AC-6 | Publication workflow has a global, non-cancelling concurrency group. | Source-level workflow test. | `tests/update_data_workflow.test.js` |
| AC-7 | Complete JavaScript/Python tests, local browser smoke, PR CI, and deployed-preview smoke pass before merge. | Automated and browser checks. | Commands and verification record. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Markup-like player name/team/opponent | Interpolated directly into HTML templates. | Encoded as visible literal text. | Unit |
| `javascript:` or `data:` image | No render policy helper. | Empty source. | Unit |
| Official HTTPS image | No render policy helper. | Original HTTPS source remains usable. | Unit |
| Unexpected position | Used as a class suffix. | `UNK` class suffix. | Unit |
| Concurrent schedule/manual triggers | No explicit serialization policy. | Same publication group and no cancellation of an in-flight run. | Source-level workflow test |
| Normal populated dashboard | Existing rendering. | Dashboard/FDR/detail-dialog user journey remains populated and accessible. | Local/browser |
| Fixture absence | Existing unknown behavior. | Remains unknown/TBC; no inferred blank gameweek. | Existing fixture tests and browser check |

## 9. Release and observability

No migration, secret, configuration variable, schedule-time change, or database change is required. The production smoke on 24 August 2026 confirmed the merged Phase 10 release loaded 279 players, opened FDR, retained dialog keyboard behavior, and controlled the browser through the production service worker. The latest five observed publication runs were successful, and the current snapshot metadata was internally consistent with production freshness.

The follow-up release must validate a deployed PR preview after merge eligibility. Rollback is a pull-request revert: it restores the prior renderer and removes the workflow concurrency policy without touching snapshots or user data.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Focused tests fail before implementation | Complete | Render utility module and publication concurrency policy tests failed as expected before implementation. |
| Tests pass | Complete locally | `npm test`: 17 Jest suites / 86 JavaScript tests and 32 Python tests passed. |
| Production smoke complete | Complete | `docs/verification/phase-11-production-smoke-20260824.md` |
| Browser/manual verification complete | Complete locally | Populated dashboard, FDR round-trip, and player detail rendered successfully. |
| Accessibility check complete | Complete locally | `Escape` dismissed the player dialog and returned to the table. |
| Data invariants reviewed | Complete | No fixture, identity, auth, RLS, or schema change is in scope. |
| Deployment/release check complete | Pending PR preview | Required after the branch is pushed. |
| Durable documentation updated | Complete | This specification and production verification record |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-24 | Treat snapshot display fields as untrusted at every existing HTML-template boundary. | The dashboard renders externally sourced data through HTML strings in several visible journeys. | Encoding and image-scheme policy are centralized in a pure helper. |
| 2026-08-24 | Queue rather than cancel overlapping publication runs. | A validated publication should finish and preserve the last known good snapshot. | A later schedule/manual run may wait, but cannot race the publish or commit step. |
