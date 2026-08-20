# Phase 9 verification — pre-launch quality and operational-readiness baseline

**Date:** 2026-08-20
**Branch:** `chore/prelaunch-readiness-baseline`
**Status:** Implemented; pull request pending
**Launch status:** **Public marketing launch remains on hold.**

## Scope verified

This pass corrected a public metadata inconsistency and established an operations/runbook baseline. The project brief designates `https://fpl-omed.vercel.app/` as the public canonical URL. Before this pass, the checked-in canonical link, social URLs and social-image URLs, and visitor-counter path still used the legacy `pl-players-stats-omed7s-projects.vercel.app` alias. The updated document metadata now consistently uses the public canonical host.

The pass deliberately did **not** modify player data, fixture/FDR logic, Google OAuth configuration, Supabase schema/RLS, public Team ID data flow, workflow schedule or permissions, secrets, Vercel configuration, static-fallback policy, marketing assets, or public-launch posture.

## Verification evidence

| Area | Check | Result | Evidence |
|---|---|---|---|
| Focused metadata regression | Added `tests/prelaunch_metadata.test.js`; it failed before the correction because `index.html` used the legacy canonical URL, then passed after the correction. | Pass | `npm run test:js -- --runTestsByPath tests/prelaunch_metadata.test.js` |
| Full regression suite | JavaScript and Python suites were run after all changes. | Pass | **73 JavaScript tests** in 13 suites and **32 Python tests** passed via `npm test`. |
| Diff hygiene | Reviewed the proposed changes and ran whitespace validation. | Pass | `git diff --check` produced no output. |
| Scheduled pipeline health | Reviewed the latest GitHub Actions data-update and test workflow outcomes. | Pass at observation time | The scheduled `Update FPL Data` workflow and corresponding test workflow both completed successfully on 2026-08-20. |
| Deployed preseason state | Read-only deployed-page check displayed zero players with the explicit season-not-started message. | Pass | `https://fpl-omed.vercel.app/` showed “The season has not started yet. Player statistics will appear after the opening matches.” |
| Public Team ID input validation | Read-only production request used invalid non-positive input. | Pass | `GET /api/fpl-team?teamId=0` returned HTTP 400. |
| HTTPS transport | Read-only header check on the canonical site. | Pass | HTTP 200 with HSTS was observed. |
| Keyboard reachability | Non-destructive Tab navigation traversed page controls. | Pass, limited smoke check | Focus reached the visitor counter after the page control sequence. A fuller visual/focus audit remains a launch-gate task. |

## Privacy, identity, and data-invariant review

| Control | Result | Evidence |
|---|---|---|
| Google OAuth only | Preserved | Deployed page exposed “Sign in with Google”; no other provider was introduced. |
| Account-synced public Team ID | Preserved | No change to `account_sync.js`, account preference schema, or Team ID persistence path. The existing signed-in copy continues to state that the Team ID and supported preferences sync with the Google account. |
| FPL credential prohibition | Preserved | The public page requests a numeric **Public Team ID** only. No FPL password, cookie, token, recovery code, or account-credential field is present or introduced. |
| Owner-only account boundary | Preserved | No Supabase schema, policy, RLS, or client ownership-code change was made. |
| Stable player identity | Preserved | No change to FPL `element_id` persistence or user-data paths. |
| Preseason semantics | Preserved | The valid zero-player preseason state remained visibly distinct from load and no-results states. |
| Fixture correctness | Preserved | No fixture logic change was made. `BGW` remains subject to explicit authoritative confirmation; unknown fixtures remain unknown/unavailable. |
| Last-known-good data | Documented and preserved | Existing atomic fetch write, publisher validation, and browser fallback were not changed. The new runbook defines the operational recovery path. |

## Operational-readiness findings

The new [`public-data publication operations runbook`](../runbooks/public-data-publication-operations.md) gives operators a normal daily check, failure classification, safe recovery, rollback, escalation, and handoff procedures. It explicitly forbids manual fabrication or publication of a partial snapshot and reinforces that the Supabase service-role key remains server-side in GitHub Actions only.

The latest data-update workflow was healthy at the observation time. However, workflow success alone is not taken as sufficient evidence of end-user health: the runbook requires a public browser state check and requires the static fallback to remain available during the current Supabase observation period.

## Remaining risks and deferred gates

| Item | Status | Required before a related decision |
|---|---|---|
| Public marketing launch | **Held** | Explicit owner approval after the remaining final launch-gate checks. This pass does not authorise launch. |
| Post-deploy metadata observation | Pending after PR merge | Confirm source/page metadata on the deployment generated by this branch. |
| Social crawler/share-card cache | Pending after PR merge | Inspect a refreshed public canonical page and social image at the canonical host; external caches may retain prior metadata temporarily. |
| Full responsive/accessibility visual audit | Deferred but required for final gate | Validate mobile layout, visible focus states, dialog focus restoration, error/loading/preseason/no-results distinctions, and canonical/share behavior on deployed preview or production. |
| Team ID fresh picks restoration | Deferred to official availability | Re-test fresh current/next-event public-picks restoration and My Squad once official FPL picks become usable; preseason unavailability is currently expected. |
| Static fallback cutover | Deferred | Observe normal completed-gameweek Supabase publication before considering removal; requires separate owner-approved criteria. |
| Branch-protection enforcement | Not available under current repository plan | Use PRs, passing CI, author checks, and review as procedural controls. No plan/entitlement change was requested or made. |
| Proactive alerting | Deferred | The runbook uses GitHub Actions status as the current monitoring source; any new observability integration requires separate scope. |

## Completion record

| Check | Result | Evidence |
|---|---|---|
| Specification created before implementation | Pass | [`Phase 9 specification`](../specs/phase-9-prelaunch-quality-operational-readiness.md) |
| Focused regression test created before correction | Pass | Test failed first, then passed after static metadata correction. |
| Full tests pass | Pass | `npm test`: 73 JavaScript + 32 Python tests passed. |
| Browser/manual check complete | Pass for non-destructive preseason/keyboard/API smoke | Production observations recorded above; post-merge metadata verification remains pending. |
| Accessibility check complete | Partial | Keyboard reachability smoke passed; final visual/focus audit deferred to final launch gate. |
| Data invariants reviewed | Pass | No fixture, fetcher, identity, data-contract, or RLS logic modified. |
| Deployment/release check complete | Pending | Must occur after PR merge. Launch remains held. |
| Durable documentation updated | Pass | Specification, operations runbook, and this verification record added. |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-20 | Correct static canonical/social URL references to `fpl-omed.vercel.app`. | That host is the project-designated public canonical URL; the legacy alias split social/canonical signals. | The PR aligns metadata with the approved public host. |
| 2026-08-20 | Preserve all account and Team ID behavior. | The Google OAuth-only and optional public Team ID design is approved and already production-verified. | No provider, privacy, schema, or credential-handling change. |
| 2026-08-20 | Keep launch on hold and retain the static fallback. | The project brief requires owner approval for launch and observation of normal completed-gameweek publication before cutover. | This pass improves evidence and recovery readiness without changing release posture. |
