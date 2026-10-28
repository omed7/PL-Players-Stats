# Public-data publication operations runbook

**Status:** Active pre-launch runbook
**Owner:** omed7
**Last reviewed:** 2026-10-28
**Launch status:** **Public marketing launch remains on hold.**
**Publication security status:** Main-only run restrictions are implemented; owner rollout remains pending. The existing repository key is retained by owner choice, so environment-only credential isolation is deferred.

## Purpose and operational boundary

This runbook covers the existing public player-data pipeline: the scheduled GitHub Actions workflow fetches Fantasy Premier League data, writes a validated `players.json` snapshot, publishes the completed snapshot to Supabase through a server-side RPC, and commits changed static data only after those steps succeed. It is a recovery guide for the application’s data path; it does not authorise a marketing launch, database migration, authentication change, or removal of the static fallback.

| Layer | Current responsibility | Credential/data boundary |
|---|---|---|
| GitHub Actions `Update FPL Data` | Main-only guarded job runs daily at `03:00 UTC`, validates through `npm test`, checks credential presence, fetches a snapshot, publishes it, then commits changed `players.json`. | Owner-selected mode: existing repository `SUPABASE_SERVICE_ROLE_KEY`, referenced only in the presence-check and publication steps of this job. The environment gates this job, but does not isolate that repository secret from other workflows. |
| `fpl_fetcher.py` | Fetches official public FPL responses, validates completed history and output completeness, and atomically replaces `players.json` only after a complete successful run. | Uses no FPL user account, password, cookie, or token. |
| `supabase_publisher.py` | Validates schema-v2 snapshot fields and publishes through `publish_fpl_snapshot`. | Uses the service-role key at runtime only; never place it in browser code, Vercel configuration, documentation, or a commit. |
| Browser reader | Reads Supabase snapshots first and retains `players.json` as a static fallback during observation. | Receives only public player data and non-secret browser configuration. |
| Team personalisation | The same-origin `/api/fpl-team` proxy validates a positive **public** Team ID and minimises current/next-event picks. | Never collect or ask for FPL passwords, cookies, recovery codes, or tokens. Public picks remain in memory, not stored as a Team profile. |

> **Data-safety rule:** Do not manually edit, fabricate, or force-publish a snapshot to clear an alert. Preserve the last known good snapshot and repair the cause through a tested pull request.

## Production publication policy and chosen credential mode

The workflow declaration restricts fetcher-path pushes to `main` and guards the entire `update-data` job with the exact `refs/heads/main` ref and the `push`, `workflow_dispatch`, or `schedule` event types. The job declares `fpl-data-production` and owns the content-write permission; existing PR validation remains read-only and has no production-secret binding. This policy takes effect when the workflow PR is merged.

| Event/ref | Production-writing job policy | Validation |
|---|---|---|
| Main push changing `fpl_fetcher.py` | Eligible, subject to environment rules | Existing main CI also runs. |
| Feature-branch push changing `fpl_fetcher.py` | Excluded by push branch filter; job guard also rejects non-main refs | A pull request receives existing PR CI. |
| Manual dispatch on `main` | Eligible, subject to environment rules | Data-contract tests precede fetch. |
| Manual dispatch on a feature branch | Blocked by job guard | No production-writing steps run. |
| Manual dispatch on a tag | Blocked: a tag is not `refs/heads/main` | No production-writing steps run. |
| Normal scheduled main run (`0 3 * * *` UTC) | Eligible, subject to environment rules | Data-contract tests precede fetch. |
| Pull request | No publication trigger; job event/ref guard excludes it | Existing test workflow runs with `contents: read`, without production secrets. |

Static regression tests verify the actual workflow declaration and isolated missing-credential behavior. They do **not** prove GitHub's live protections, scheduler behavior, credential validity, or rollout. A public fork PR is not known to receive these secrets; this repair addresses experimental branch publication, not an anonymous exploit.

**Owner decision — 2026-10-28:** Keep using the existing repository secret named `SUPABASE_SERVICE_ROLE_KEY`; do not copy, regenerate, replace, or delete it. Read-only metadata confirmed that name exists. The separately approved `fpl-data-production` environment was created and read back with exactly one allowed deployment rule (`main`, type `branch`), no tag rules, and zero environment secrets. With no environment secret of the same name, the job's existing `${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}` expression resolves the repository secret. No workflow change or additional key is needed for this choice.

**Remaining limitation:** The environment restricts the declared job, not every use of a repository-level secret. A repository writer could change another workflow to request that secret without the environment binding. Thus the main-only run guard is implemented, but environment-only credential isolation is **deferred, not completed**. Do not describe this PR as fully resolving the audit's credential-boundary concern.

**Owner/reviewer checklist — before a separately approved merge:**

- [ ] Review current green PR CI and the policy above; do not dispatch the updater just to demonstrate the guard.
- [x] Create and read back `fpl-data-production` with the **main branch only**, no allowed tag rule. Completed with owner approval on 2026-10-28; recheck if settings change.
- [x] Confirm the existing repository secret's name/scope without reading its value. Owner chose to retain it on 2026-10-28; the environment remains empty.
- [ ] Obtain owner approval for merge/rollout, accounting for the normal schedule and any old in-flight jobs. This credential decision does not itself authorize merge, a dispatch, or a production-data write.
- [ ] After approved rollout, observe the next ordinary scheduled run (or a separately approved operational run) and record its ref, event, environment, stage outcomes, and commit/no-change result.

**Deferred stronger protection:** If the owner later approves environment-only credential isolation, configure the existing key value as an environment secret, coordinate the workflow/schedule transition and old jobs, then remove all equivalent unrestricted repository/organization access. Do not remove the current key prematurely or ask for it in chat/logs. This is future hardening, not a prerequisite the owner has accepted for the current reduced-scope release.

If the resolved publishing credential is absent, the preflight fails clearly **before fetch/publication**. Check only presence and scope metadata; the diagnostic's environment name identifies the publication job, not proof of where the key is stored. A presence check does not establish validity or isolation. Preserve current data on failure; do not bypass the check, substitute a browser key, skip publication, or weaken the main-only policy.

## Normal operating check

Perform this check after the scheduled run and before any future public-launch decision. The daily schedule is `0 3 * * *` UTC; owner-approved manual workflow dispatch on `main` is also available, subject to the environment rules and owner rollout checklist above.

| Check | Expected healthy result | Evidence to record |
|---|---|---|
| GitHub Actions workflow | The latest `Update FPL Data` run has conclusion **success**. Its `npm test`, credential-presence check, fetch, publication, and no-change-or-commit steps finish successfully. | Run URL, start time, conclusion, main ref, event, environment, and commit SHA if data changed. |
| Regression suite | Test workflow or data workflow shows the current JavaScript and Python suites passing. | CI run URL and test summary. |
| Snapshot update | A changed `players.json` is committed only after a successful publication; a no-change run says so explicitly. | Commit SHA or no-change log line. |
| Browser state | The public site loads public data from Supabase when available. During preseason, a valid zero-player snapshot renders the explicit season-not-started state—not a load error or empty filter result. | Timestamped deployed-page observation. |
| Privacy surface | Google remains the only sign-in provider. The Team ID control requests only a positive public Team ID and does not show any FPL credential field. | Deployed-page observation; do not sign in merely for this check. |

Use these read-only commands from a repository checkout to retrieve recent operational evidence:

```bash
gh run list --repo omed7/PL-Players-Stats --limit 12
npm test
curl --fail --silent --show-error --head https://fpl-omed.vercel.app/
```

A successful workflow is necessary but not sufficient evidence: check its individual stages and the browser’s visible data state. Do not treat a missing fixture as an authoritative blank gameweek. The application may display `BGW` only from an explicit authoritative confirmation; incomplete fixtures stay unknown or unavailable.

## Publication concurrency observation

The workflow uses the shared `fpl-data-publication` concurrency group with `cancel-in-progress: false`. A scheduled, manual, or fetcher-triggered workflow that starts while another output-writing publication is active is therefore expected to wait rather than race the snapshot publication or cancel a validated in-flight run.

> **Safety rule:** Do not create an artificial concurrent production run merely to demonstrate queueing. The normal daily schedule or an owner-approved operational need is the evidence source. An in-flight publication remains preferable to a rushed duplicate write.

| Observation | Expected result | Evidence to record | Escalate when |
|---|---|---|---|
| One normal scheduled run | The run completes successfully and preserves normal fetch, validation, publish, and commit/no-change behavior. | Run URL, UTC start/end, conclusion, and snapshot timestamp. | The run fails or the public data state is inconsistent. |
| A natural overlap occurs | The later run appears pending in the same `fpl-data-publication` group until the active run finishes. | Both run URLs, triggering events, queue duration, and final conclusions. | The active run is cancelled, runs overlap their publication steps, or the pending run never progresses. |
| The queued run starts | It executes the normal validation, fetch, publication, and commit/no-change steps after the earlier run completes. | Job-level outcomes and whether `players.json` changed. | Validation or publication is skipped, or a partial/invalid output appears. |

A passing source-level policy test proves the workflow declaration, not GitHub scheduler behaviour. Close the runtime portion of this check when the next ordinary scheduled run has completed after the Phase 11 merge; record any natural queued run separately when it occurs.

## Failure triage

When the scheduled workflow is red, first preserve evidence. Note the run URL, job/step name, UTC time, current `main` SHA, the preceding successful run, and whether `players.json` changed. Do not rerun repeatedly until the failing stage has been identified.

| Failing stage or symptom | Likely safe interpretation | Immediate action | Prohibited action |
|---|---|---|---|
| `npm test` fails | A regression or test-environment issue blocks the data run before fetch/publish. | Inspect the failing test, reproduce locally, make the smallest tested PR repair, and merge only after CI is green. | Do not bypass or delete failing tests. |
| Environment blocks the job or publishing credential is absent | Required production configuration is unavailable; no fetch/publication should occur. | Preserve existing data and inspect the main-only environment rule and existing repository secret name/scope. Ask the owner to resolve missing configuration; do not require the deferred key migration as an automatic repair. Check metadata only. | Do not expose the key, substitute a browser key, skip publication, or bypass environment rules. |
| FPL bootstrap/history request fails, times out, or returns malformed data | An upstream/API availability or contract issue; data completeness is unknown. | Preserve the last good snapshot. Check the FPL response read-only, wait for recovery or adapt through a tested PR if the contract changed. | Do not publish partial player data or infer football facts. |
| Fetcher schema/completeness/output-write error | The new candidate snapshot is invalid or incomplete; the atomic write should preserve existing `players.json`. | Confirm the working-tree diff does not include a partial file, then repair the validation/data-contract cause through a PR. | Do not commit a temporary empty or partial `players.json`. |
| Supabase publication error | A completed local snapshot was not confirmed by the server-side publisher. | Verify the secret is present without displaying it, inspect HTTP/RPC failure logs, and create a tested PR only if code needs repair. The prior Supabase snapshot remains the intended public source. | Do not paste, rotate, or expose the service-role key in logs, Vercel, browser code, or Git history. |
| Commit/push failure after publish | Supabase may be current while the static fallback has not updated. | Record both state versions; resolve repository permissions/conflict safely and run a controlled workflow after correction. | Do not claim the static fallback is updated until the commit is present. |
| Browser reports unavailable data | Supabase may be unavailable, stale, or invalid; the browser may fall back to `players.json`. | Check the latest workflow and static commit, then observe the error/preseason/no-results distinction. Create a focused PR if fallback behaviour is broken. | Do not disable the fallback while the staged observation decision remains pending. |

## Safe recovery procedure

1. **Identify the last known good state.** Find the most recent successful `Update FPL Data` run, its associated `main` SHA, and the latest known healthy public site observation.
2. **Classify the failure.** Distinguish test, upstream-data, fetcher-validation, publication, commit, or browser-read failures. Treat uncertain or incomplete source data as unavailable rather than as a football result.
3. **Contain the incident.** Leave the last known good GitHub/Supabase data intact. Do not alter release posture, collect FPL credentials, or run unaudited manual publication commands.
4. **Reproduce safely.** Use a local checkout and the existing tests. For external failures, make read-only requests only and retain error output without secrets.
5. **Repair with a PR.** Begin from an approved specification, add or update the focused regression test, make the smallest coherent change, run `npm test`, and open a pull request. Use author `omed7 <omed7@users.noreply.github.com>`.
6. **Validate after merge.** Confirm green pull-request and main CI, then observe the next scheduled or a deliberately dispatched workflow. Check the public site’s relevant state without treating the workflow green status alone as proof of user-visible health.
7. **Record the outcome.** Add a dated verification note with the incident class, evidence links, repair commit, final workflow result, and deferred risks.

## Rollback procedure

For a code or static-metadata regression, revert the responsible pull request through a new pull request, run the full test suite, and verify CI. Do not push directly to `main`.

For a data-pipeline regression, keep the last valid `players.json` commit and prior Supabase snapshot in place. Revert the smallest responsible implementation change through a new PR, while retaining the main-only publication guard, the `fpl-data-production` environment binding, and the owner-selected credential scope. If environment-only isolation is later approved, do not blindly revert this protection change after that cutover: removing its environment binding prevents the old workflow from accessing the publishing credential; it does not restore access to that environment secret. If the protection itself needs repair, preserve current data and use an owner-reviewed fix-forward or an explicitly approved publication pause. Never restore an unrestricted repository/organization secret as a rollback shortcut. The current browser reader's static fallback remains available until its removal is separately approved.

| Scenario | Rollback state | Verification |
|---|---|---|
| Static front-end change | Revert the PR; Vercel deploys the prior application state from `main`. | Green CI plus deployed-page check. |
| Fetcher/publisher/workflow code change | Revert the smallest responsible change through a PR; retain main-only publication, the environment binding, the owner-selected credential scope, and last known good data. | Green CI plus owner-approved normal-run observation; never restore unrestricted credentials. |
| Bad external FPL response | No code rollback needed unless code misclassified the response. Preserve last valid output and wait or repair validation by PR. | Confirm no invalid snapshot was committed or published. |
| Supabase availability incident | Leave static fallback available; do not expose the service role key to the browser. | Confirm browser’s source/error state and service recovery. |

## Escalation and handoff

Escalate to the project owner when an incident affects a public snapshot for more than one expected update window, requires a secret change, calls for a schema/RLS/authentication-provider decision, or raises a privacy/security concern. The owner must explicitly approve any transition from the current launch hold to public marketing.

The next operator should receive the failed/successful run URL, current and preceding good SHAs, browser observation, affected boundary, remediation PR, and whether a follow-up is needed after live FPL picks become available. **Do not request FPL credentials from the owner or any user under any circumstance.**

## Related evidence

| Resource | Purpose |
|---|---|
| [`Update FPL Data` workflow](../../.github/workflows/update_data.yml) | Scheduled fetch, validation, publication, and commit implementation. |
| [`fpl_fetcher.py`](../../fpl_fetcher.py) | Atomic output and completeness safeguards. |
| [`supabase_publisher.py`](../../supabase_publisher.py) | Server-side snapshot validation and publication boundary. |
| [`FPL Engineering Guide`](../agent-workflow/FPL-Engineering-Guide.md) | Product invariants and required delivery checks. |
| [`Phase 9 specification`](../specs/phase-9-prelaunch-quality-operational-readiness.md) | Scope and acceptance criteria for this baseline pass. |
