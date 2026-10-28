# Feature Specification — Main-only production FPL publication

**Status:** Implemented and locally verified; owner release pending

**Owner:** omed7

**Date:** 2026-10-27; recovery review updated 2026-10-28

**Related issue / PR:** Branch `fix/main-only-data-publication` targets `main`; see the pull request containing this file. The original Codex connector/push attempts returned 403. Omed authorized Minis to recover and deliver this reviewed work on 2026-10-28.

## 1. Outcome

Experimental branch code currently can run the production-writing data job. Only a main-ref push, schedule, or manual dispatch may run that job; credential-free PR CI must continue. Live secret isolation requires a separate owner-approved environment cutover.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Publication workflow, focused tests, this specification, operations checklist | Fetcher/publisher code, statistics, JSON data, browser/UI, SQL/RLS, dependencies |
| Static policy and isolated credential-presence checks | Live settings/secrets changes, real fetch/publication, workflow dispatch, merge, rollout |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Source revision | Original Codex base: `fdb944da8997ddf4294c41bde7471617667059b1`. Recovery base: `2ea9348f8a968d1a60098ed8fa531faba7a8a693`; only `players.json` advanced, and its current contents are preserved. | Fresh upstream comparison on 2026-10-28 | No |
| Event policy | Exact main branch ref and only push, schedule, workflow_dispatch. | Approved task | No |
| Credential boundary | Dedicated `fpl-data-production`; step-local service role only for presence check and publisher. | Approved task | No |
| Live configuration | Owner separately configures environment and cuts over unrestricted secrets. No settings changes here. | Approved task; release blocker | No (deferred owner action) |

## 4. User journey and behaviour

1. Main fetcher-path push, daily schedule, or main manual dispatch becomes eligible.
2. Job guard and environment rules gate all production-writing steps.
3. Tests pass, credential presence is checked, fetch validates, publication succeeds, then changed data is committed/pushed.
4. Missing credential fails before fetch; failures stop later stages and preserve last known good published/committed data. Branch/tag dispatches and PRs cannot run this job.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
| `players.json` / Supabase snapshot | Existing validated fetch/publication path | No generation/statistical changes; tests → fetch → publication → commit | Preserve last known good; propagate failures |
| Service-role key | GitHub environment secret after owner cutover | Presence check only; never log/serialize the value | Fail clearly; no fallback or skipped publication |
| Publication queue | Existing workflow concurrency | `fpl-data-publication`, `cancel-in-progress: false` | Do not cancel active validated publication |

All existing FPL invariants remain unchanged, including explicit-only BGW confirmation and valid zero-player preseason handling.

## 6. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `update_data.yml` | Main push filter, job ref/event guard, environment, job-only write permission, credential preflight | Gate the entire writing path | Parse actual YAML; execute only preflight with synthetic inputs |
| `update_data_workflow.test.js` | Policy/order/failure regressions; retain concurrency regression | Prevent branch publication regression | Existing Jest and lockfile's `js-yaml` |
| Operations runbook | Policy matrix and pending owner checklist | Distinguish source guarantees from live isolation | Review against approved task |

No extra dependency or expression interpreter. Ship via branch PR only. Rollback must retain the main-only guard, environment binding, and credential isolation. Removing the binding after an environment-only cutover prevents the old workflow from accessing the credential; it does not itself expose the environment secret. If this guard needs repair, preserve current data and use an owner-reviewed fix-forward or explicitly approved publication pause, never unrestricted secret restoration.

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | Only main fetcher-path pushes; daily `0 3 * * *` and dispatch retained | Parsed trigger assertions | Pass |
| AC-2 | Entire job requires exact main-ref and push/schedule/dispatch allowlist | Exact normalized guard assertion and runbook matrix | Pass (static only) |
| AC-3 | Dedicated environment; workflow/PR read-only; only guarded job writes; key step-local | Parsed permission/environment/secret assertions | Pass (declaration only; live protections pending) |
| AC-4 | Missing key fails clearly before fetch; present synthetic key stays silent | Execute extracted preflight shell only | Pass (unset, empty, synthetic present) |
| AC-5 | Existing ordering, queue, failure propagation, no-change handling preserved | Focused regressions and full suite | Pass |
| AC-6 | Owner setup/cutover explicitly pending; no live changes or rollout | Runbook checklist and PR review | Checklist recorded; owner execution pending |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Main restrictions/environment/permissions | Policy tests fail | Pass | Parsed workflow |
| Feature/tag dispatch or PR publication | Missing explicit exclusion fails | Exact guard excludes | Static declaration + documented matrix |
| Absent credential | Missing preflight fails | Nonzero, clear diagnostic, before fetch | Isolated shell |
| Synthetic present credential | Missing preflight fails | Zero, no value in output | Isolated shell |
| Queue/order/no-change/PR CI | Existing behaviour passes | Remains passing | Regression |

Add failing tests before workflow edits. Run `npx jest --runInBand tests/update_data_workflow.test.js`, `npm test`, `git diff --check`, and an available workflow/YAML validator. Do not run the real fetcher/publisher or dispatch a workflow.

## 9. Release and observability

Owner/reviewer must verify main-branch-only environment rules (no tag rule), secret name/scope, and a coordinated cutover removing equivalent unrestricted repository/organization access without prematurely breaking the old schedule. Full security completion is blocked until those actions and live observations are recorded. Static tests cannot prove live protections. No merge or production run is authorized here.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Tests pass | Pass | Focused suite: 8 failed / 2 passed before implementation → 10 passed. Full suite: 149 JS / 32 Python passed. Commands below. |
| Browser/manual verification complete | N/A | No UI change; no production run authorized |
| Accessibility check complete | N/A | No UI change |
| Data invariants reviewed | Pass | Data-generation code and data files unchanged |
| Deployment/release check complete | Pending owner action; blocking full security completion | Runbook owner checklist |
| Durable documentation updated if needed | Complete | [Operations runbook](../runbooks/public-data-publication-operations.md#production-publication-policy-and-pending-owner-cutover) |
| Branch/PR delivery | Submitted separately from production rollout | Omed authorized Minis delivery of the recovered implementation on 2026-10-28. Original Codex connector/push attempts returned 403; delivery status and CI are tracked in the containing PR. |

Verification commands/results:

- `npx --no-install jest --runInBand tests/update_data_workflow.test.js`: 10 passed after repair. Default sandbox initially denied Bash child processes (`spawnSync bash EPERM`); reran with supported sandbox permissions. Only the isolated preflight shell was executed.
- `PATH=/tmp/pl-publication-test-venv/bin:$PATH npm test`: 26 JS suites / 149 tests and 32 Python tests passed. Initial full run passed JS but failed Python imports because `requests` was absent; installed it only in a temporary virtualenv, matching the workflow prerequisite.
- `git diff --check`: passed.
- `/tmp/pl-actionlint-bin/actionlint -shellcheck= -pyflakes= .github/workflows/update_data.yml .github/workflows/test.yml`: passed with actionlint 1.7.7. ShellCheck/Pyflakes unavailable and disabled; existing `js-yaml` also parses both files in the tests. Local `go install` was unavailable, so actionlint used its release binary.

Dependency setup: initial `npm ci` could not write the default cache; `npm ci --cache /tmp/pl-players-stats-npm-cache --no-audit --no-fund --loglevel=error` succeeded without changing manifests or lockfiles. No live environment/secret/protection verification, real fetch/publication, workflow dispatch, or rollout was performed.

## 11. Recovery verification — Minis, 2026-10-28

Omed approved completing the agreed repair plan in Minis after the external Codex delivery failures. The reviewed workflow and test bytes were recovered unchanged onto current main `2ea9348f8a968d1a60098ed8fa531faba7a8a693`; current `players.json` was preserved. Only rollback guidance and this recovery/provenance record were clarified after recovery.

- `npm test`, with inherited credentials removed: 149 JavaScript tests across 26 suites and 32 Python tests passed (181 total). The real fetcher/publisher was not run.
- `actionlint -shellcheck= -pyflakes= .github/workflows/update_data.yml .github/workflows/test.yml`: passed using Alpine actionlint 1.7.4; ShellCheck/Pyflakes were explicitly disabled.
- `git diff --check` / staged equivalent: passed.
- Production environment setup, credential cutover, merge, and rollout remain separately approved work; no live security completion is claimed.

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-10-27 | Separate source guard from owner-approved secret cutover | YAML cannot configure protections or remove unrestricted equivalents | Implement/test code without claiming live isolation |
| 2026-10-28 | Recover reviewed work in Minis and clarify security-preserving rollback | Omed changed the implementation workflow; review found the generic revert recipe insufficient after credential cutover | Deliver via a branch PR; retain protections during rollback and keep live setup separately pending |
