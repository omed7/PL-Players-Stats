# Feature Specification — Phase 9: Pre-launch quality and operational readiness baseline

**Status:** Implemented; pull request open
**Owner:** omed7
**Date:** 2026-08-20
**Related issue / PR:** [#66](https://github.com/omed7/PL-Players-Stats/pull/66)

## 1. Outcome

FPL Omed’s public canonical URL must be represented consistently in the HTML canonical link, social metadata, social-image URL, and view-counter path. Operators also need a concise, repository-owned procedure for observing the scheduled public-data publication workflow, handling a failure without publishing invalid data, and rolling back to the last known good snapshot. These changes improve the launch gate while **public marketing launch remains on hold**.

The deployed application already treats the current zero-player dataset as a valid preseason state, exposes Google OAuth only, and accepts an optional public FPL Team ID without FPL credentials. This change preserves those behaviours and does not alter authentication, Supabase schema/RLS, data contracts, or public-launch status.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Change `index.html` canonical, Open Graph, Twitter, social-image, and visitor-counter URLs from the legacy Vercel alias to `https://fpl-omed.vercel.app`. | Enabling public marketing, removing the launch hold, or publishing marketing assets. |
| Add a focused automated regression test that verifies the canonical and social URLs point to the designated canonical site. | Any change to player data, fixtures, FDR, blank-gameweek logic, or the static JSON fallback. |
| Add a data-publication operations and rollback runbook based on the existing GitHub Actions fetcher, validated snapshot publisher, and static fallback. | Changing GitHub Actions permissions, schedules, Supabase schema/RLS, secrets, or Vercel environment variables. |
| Record the baseline findings and remaining operational risks in a verification record. | Adding monitoring vendors, analytics, error tracking, or alerting integrations. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Canonical site | `https://fpl-omed.vercel.app` is the sole public canonical site. | Project brief, 2026-08-20. | No |
| Product behaviour | The valid zero-player snapshot remains a preseason state, not an error. | Engineering guide and deployed-site observation. | No |
| Security / privacy | Google OAuth remains the only account provider. The optional public Team ID may be synced for signed-in users; FPL passwords, cookies, and tokens are never requested, stored, or transmitted. | Project brief and `AGENTS.md`. | No |
| Publication safety | The scheduled job must fail on invalid fetch/publish output and retain the last known good GitHub/Supabase snapshot. | `fpl_fetcher.py`, `supabase_publisher.py`, and workflow configuration. | No |
| Branch protection | This private repository cannot use GitHub branch-protection rules under the current GitHub plan. Pull requests, passing CI, and explicit review remain the procedural gate. | GitHub API check, 2026-08-20. | No |

## 4. User and operator journeys

1. A visitor or social crawler requests the public page.
2. The page exposes `https://fpl-omed.vercel.app/` as its canonical URL and uses that same host in Open Graph/Twitter social-image URLs.
3. The player experience, Google sign-in flow, and optional public Team ID flow remain unchanged. Signed-in users retain account-synced Team ID preferences; anonymous users retain device-local preferences.
4. Once daily, the scheduled data workflow runs the regression suite, generates a validated snapshot, publishes it atomically through the server-side Supabase RPC, and commits `players.json` only after the preceding steps succeed.
5. If the workflow fails, the operator follows the runbook: confirm the failing stage, preserve the prior snapshot, correct the cause through a tested PR, and use the last good Git commit/Supabase snapshot or static fallback as the rollback path. No manual data change is made without an approved, tested correction.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| Canonical URL and social URLs | `index.html` | Every public canonical and social URL uses `https://fpl-omed.vercel.app`. | A failing regression test blocks the PR before deployment. |
| Player snapshot | FPL API through `fpl_fetcher.py` | Bootstrap, history, completeness, schema, and output-write failures must fail the workflow. A valid zero-player preseason output is allowed. | Existing `players.json` remains unchanged; no invalid snapshot is published. |
| Supabase public snapshot | GitHub Actions server-side publication only | Service-role credential stays in GitHub Actions secret only; publication validates the completed schema-v2 snapshot. | Publication error fails the workflow; last known good Supabase snapshot remains available. |
| Google account and preference data | Supabase Auth and owner-scoped tables | Google OAuth only. Owner-only RLS and stable FPL element IDs remain unchanged. | This change makes no schema, auth-provider, or RLS modification. |
| Public Team ID | Browser input plus same-origin `/api/fpl-team` proxy | Positive numeric public identifier only; no FPL credentials are collected. Signed-in account sync remains available. | Unavailable picks remain neutral/unavailable; stored Team ID is not treated as proof of ownership. |

> **Invariant:** A missing fixture is never proof of a blank gameweek. This pass does not change fixture logic and must not regress that rule.

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `index.html` | Replace legacy deployment alias in canonical, Open Graph URL/image, Twitter image, and visitor-counter path with the canonical host. | Align crawl/share signals with the owner-approved public URL. | New Jest source-level metadata regression test. |
| `tests/prelaunch_metadata.test.js` | Read `index.html` and assert that required canonical/social tags use `https://fpl-omed.vercel.app`, while the legacy alias is absent. | Prevent accidental reintroduction of split metadata. | `npm run test:js`. |
| `docs/runbooks/public-data-publication-operations.md` | Document the normal workflow, observable health signals, safe failure triage, recovery, rollback, and handoff boundaries. | Make the existing last-known-good safeguards operationally usable. | Manual document review against workflow/fetcher/publisher code. |
| `docs/verification/phase-9-prelaunch-readiness-baseline-20260820.md` | Record local tests, deployed checks, controls confirmed, remaining risks, and launch-hold status. | Preserve auditable pre-launch evidence. | Final PR evidence review. |

The URL edits are a static, backward-compatible metadata correction. They neither route traffic nor modify data. The operational runbook describes existing controls rather than changing the production runtime. Reverting this PR cleanly restores the previous metadata and removes documentation only; no database, secret, or user-data rollback is required.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Canonical, Open Graph URL, Open Graph image, Twitter image, and visitor-counter path use `https://fpl-omed.vercel.app`; the legacy Vercel alias is absent from `index.html`. | Focused Jest test and source review. | Test output and final diff. |
| AC-2 | The full JavaScript and Python regression suite remains green. | `npm test`. | CI/local output. |
| AC-3 | The repository contains an actionable public-data operations runbook describing normal checks, failed-run triage, safe recovery, rollback, and secret boundaries. | Documentation review against workflow/fetcher/publisher source. | Runbook and verification record. |
| AC-4 | The pass explicitly confirms unchanged Google OAuth-only authentication, account-synced public Team ID handling, owner-only data boundary, no FPL credential collection, and hold-launch status. | Source and deployed-page review. | Verification record. |
| AC-5 | A PR is opened from a dedicated branch with passing CI; no production launch, provider change, secret change, or database migration is initiated. | Pull-request and workflow links. | PR description and CI status. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Canonical/public share metadata | Legacy alias is present in the static document metadata. | All tested canonical/social URLs use the approved host; legacy alias is absent. | Unit/source regression test |
| Valid preseason data | Zero players render as season-not-started. | Unchanged; still distinct from load and no-results states. | Existing regression suite and deployed-page check |
| Team ID invalid input | Non-positive Team ID is rejected without credentials. | Unchanged; production endpoint returns HTTP 400 for `teamId=0`. | Deployed API check |
| Data-source/publisher failure | Existing fetcher or publisher raises before replacing the last good output. | Unchanged; documented operator recovery path exists. | Existing Python tests and runbook review |
| Account preferences | Google sign-in and account-synced public Team ID exist. | Unchanged; no provider, schema, RLS, or Team ID logic change. | Existing account tests and source review |

The metadata regression test should fail before the static URL correction is applied. The test runner is `npm run test:js`; final verification adds `npm test`.

## 9. Release and observability

The static metadata correction deploys through the ordinary Vercel Git integration after merge. The canonical URL will be verified on the deployed site and in page source/metadata. The scheduled GitHub Actions run is the primary public-data health signal: its test, fetch, publish, and commit steps are reviewed through GitHub Actions. The runbook also points operators to the latest successful run, the most recent `players.json` commit, and the Supabase-first reader/static fallback boundary.

Rollback is a PR revert. For data workflow incidents, the operator does not overwrite or manually fabricate snapshots: the existing job preserves the last valid JSON, the publisher validates before publication, and the browser retains the static JSON fallback during the current staged observation period. Any code repair follows the same PR-and-CI process.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Focused metadata test passes | Pending | `tests/prelaunch_metadata.test.js` |
| Full regression suite passes | Pending | `npm test` |
| Browser/manual verification complete | Pending | Verification record |
| Accessibility check complete | Pending | Verification record |
| Data invariants reviewed | Pending | This specification and runbook |
| Deployment/release check complete | Pending; launch remains held | PR and deployed preview/production metadata check |
| Durable documentation updated if needed | Pending | Runbook and verification record |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-20 | Correct metadata to the public `fpl-omed.vercel.app` host now. | The project brief names this host canonical, while static metadata pointed at a legacy alias. | Social/crawler signals no longer split across hosts. |
| 2026-08-20 | Do not change authentication, Team ID storage, credentials, schema, RLS, workflow permissions, or launch status. | These controls are established and outside the narrow metadata/operations baseline. | The pass remains low-risk and reversible. |
| 2026-08-20 | Keep the static fallback while observing healthy Supabase publication. | The project brief defers fallback removal until normal completed-gameweek publication is observed. | Recovery remains available during pre-launch observation. |
