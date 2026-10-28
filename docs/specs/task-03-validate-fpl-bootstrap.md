# Feature Specification — Validate the FPL starting response

**Status:** Implemented; local/source compatibility verified; separate PR/CI review pending

**Owner:** omed7

**Date:** 2026-10-28

**Related PR:** Branch `fix/validate-fpl-bootstrap`, targeting main after PR89.

## 1. Outcome

A malformed HTTP-success response from FPL's `bootstrap-static` endpoint must not be treated as proof of preseason and replace valid saved data with an empty player list. Validate the source structure before deriving season state or requesting player histories. A real preseason with zero eligible players, and the existing documented all-empty eligible-history preseason case, must remain supported.

## 2. Scope and non-goals

Only initial bootstrap structure/identity/eligibility/event-state validation and regression tests. Do not change aggregation formulas, output schema, player eligibility (`minutes > 0`), histories/fixtures transformations, publisher/browser/SQL validation, account/UI/cache behavior, dependencies, credentials or workflows. Later audit repairs handle missing/nonfinite statistics, fixtures and duplicates in match histories.

## 3. Assumptions and decisions

- Base: `ed2b6b6dd36a25cf8b4f28477b84e15dd8254ec5`.
- `teams`, `events`, `elements` must be nonempty lists of objects. A valid zero-player OUTPUT means a populated bootstrap whose players have zero eligible minutes, not an empty official player catalogue.
- Require unique positive integer IDs (booleans are not IDs), usable team code/short name, known team references and nonnegative integer eligibility minutes. Do not hard-code 20/38/player-count quotas or reject unknown extra fields.
- Event state fields consumed by this fetcher are explicit booleans; deadlines are valid timezone-aware ISO timestamps. Allow a current event to also be finished: the official current GW8 has exactly that shape.
- Before accepting a not-live season, require exactly one next event with ID1 and no current/finished event. No wall-clock guessing or stale-data freshness policy is added.
- Keep existing current-gameweek/deadline selection, ordering, count guards and all-empty preseason history rules after the validated source is accepted.

## 4. User/system journey

Fetch the public bootstrap → validate it → derive existing season state → fetch/validate eligible histories → write atomically only when existing completeness checks succeed. A validation error must stop before any history request or output write, leaving the previous file untouched.

## 5. Contract/invariants

Reject absent/empty/wrong-type collections, invalid/duplicate identity records, unknown player teams, invalid eligibility minutes, absent/wrong-type event flags, invalid deadlines, ambiguous duplicate current/next markers, an event both current and next, a finished next event, and absent/contradictory preseason evidence. Preserve zero-minute catalogue rows, legitimate all-empty preseason history behavior and all displayed formulas. Never fabricate a BGW.

## 6. Technical design

Add a small pure `validate_bootstrap_response` function in the existing Python fetcher and call it immediately after `fetch_json`, before constructing mappings/state. Return the same source object without rewriting/coercing fields. Raise contextual `RuntimeError` without logging raw response contents. No new module/package or production endpoint.

## 7. Acceptance criteria

- AC1: Audit's all-empty bootstrap and malformed structures fail before write.
- AC2: A complete zero-eligible preseason and eligible/all-empty-history preseason still write the valid empty schema-v2 candidate.
- AC3: Normal live, between-gameweek/current-finished and end-season event shapes remain accepted without changing valid output.
- AC4: Invalid identity, eligibility or season evidence cannot silently collapse output into preseason; last-good file bytes remain unchanged.
- AC5: Read-only official bootstrap compatibility and full existing suites pass; no real updater/publisher or production write is executed.

## 8. Tests

First add real `get_fpl_data` control-flow regressions with all network/session interactions mocked and a mocked writer. Preserve a separate temporary-file last-good test. Record red then green. Compare complete candidates from old/new code on valid synthetic live/preseason responses; validate one saved public bootstrap read only. All suites run with inherited credentials removed.

## 9. Release/observability

Separate branch/draft PR, no auto-merge/manual deployment/dispatch. PR88 already blocks feature-branch fetcher pushes from production publication; confirm remote checks contain no data-update run. Malformed upstream now intentionally fails rather than publishes; the saved site data remains available. Merge requires separate Omed approval. Preserve publishing guard and existing-key mode if reverting.

## 10. Completion record

| Check | Result |
|---|---|
| Test-first reproduction | 21 new unittest methods were run before the fix; malformed-input subtests produced 67 failures and 31 errors, including the audit's all-empty-source overwrite path |
| Focused regressions | All 21 new methods and their malformed-input subtests passed after repair; session/fetch/writer mocked, except the synthetic temporary-file preservation check |
| All Python regressions | 53 passed (32 existing + 21 new) |
| Full suite | `npm test` with inherited credentials removed: 164 JS tests / 27 suites + 53 Python tests = 217 passed |
| Valid-output compatibility | All candidate fields except volatile `fetched_at` identical to the base for 8 live/preseason/current-finished/end-season scenarios |
| Actual public source | One read-only official bootstrap GET; pure validator accepted its 20 teams / 38 events / 669 catalogue players / 451 eligible without mutating the source. No real history requests or publisher execution |
| Independent review | No blocking correctness/false-rejection/safety issue; reviewer separately ran all 21 tests, checked saved-source acceptance and AST equality of prior logic after removing only validator/call |
| Target runtime | Local Python 3.12; GitHub workflow Python 3.10 CI must pass before merge. No Python-3.11+-specific syntax introduced |
| Scope/release | Only the initial source guard, new tests and this spec. No player-data, formula, workflow, browser, SQL, dependency or credential change; no merge/dispatch authorized |

UI/browser smoke is not required for this Python-only guard. This establishes structure/season-evidence safety, not full upstream completeness or freshness: structurally plausible truncated/stale data and the audit's deferred metric/history/fixture problems remain outside this guarantee. Existing post-season gameweek fallback behavior is deliberately unchanged. No production update is claimed verified here.

## Decision log

| Date | Decision | Rationale |
|---|---|---|
| 2026-10-28 | Start with a narrow bootstrap guard, not all data hardening in one PR | Protect empty/preseason interpretation while keeping subsequent metric/fixture/SQL repairs reviewable |
