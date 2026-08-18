# FPL Omed Engineering Guide

## Purpose

Use this guide for every **non-trivial** FPL Omed change: a bug fix, user-facing feature, data-contract change, dependency change, deployment change, or Supabase migration step. Keep trivial typo or copy edits proportionate.

The guide adapts a small set of engineering practices from [mattpocock/skills][1] and the four delivery principles in [andrej-karpathy-skills][2]. It is intentionally project-specific and does not install an external agent runtime.

## Non-negotiable product invariants

| Invariant | Required behaviour | Prohibited behaviour |
|---|---|---|
| Blank gameweeks | Render `BGW` only when an authoritative source explicitly confirms a blank. | Do not infer a blank merely because an expected gameweek is missing from fixture data. |
| Incomplete fixture data | Render known fixtures; represent unknown or unassigned fixture data as unavailable. | Do not turn API lag, missing assignments, or partial source data into football facts. |
| Preseason data | Treat a valid zero-player output from the `minutes > 0` filter as an expected season-not-started state. | Do not present it as a filter result or a loading failure. |
| Data pipeline | Fail visibly on bootstrap, schema, or output validation errors. Preserve the last valid dataset. | Do not exit successfully after a fatal fetch error or silently replace data with an invalid snapshot. |
| FPL credentials | Use app-native authentication and an optional public FPL Team ID only. | Never collect, transmit, or store FPL passwords. |
| User-owned data | Enforce privacy in the database with RLS based on `auth.uid()`. | Do not rely on application-layer ownership checks alone. |
| Player identity | Use the FPL element ID as the durable identifier for persisted user data. | Do not use display names as a primary key for a watchlist, comparison, or database row. |

## Delivery protocol

### 1. Clarify the change

Write a one-paragraph problem statement and list the affected user journey, source data, and non-goals. State assumptions explicitly. If an assumption changes product behaviour, data correctness, security, or schema design, request a decision rather than guessing.

### 2. Create a feature specification

For any change larger than a contained bug fix, copy [`Feature-Spec-Template.md`](Feature-Spec-Template.md). Define acceptance criteria in observable terms and identify the relevant test seam before implementation.

### 3. Establish the regression or behaviour test

Create a focused automated test before changing the affected pure logic. When the change is primarily UI or deployment behaviour, define a reproducible browser/manual check. A test must describe one meaningful behaviour, not merely exercise lines of code.

| Change type | Minimum verification |
|---|---|
| Fixture/FDR logic | Unit tests covering ordinary fixtures, doubles, delayed/missing data, and explicitly confirmed blanks. |
| Fetcher/data contract | Unit tests for successful response, non-200 response, invalid JSON/schema, partial player failure, active-season completeness guard, and legitimate preseason zero-player output. |
| Filter/statistics logic | Unit tests for timeframe, venue-first slicing, price/minutes filters, sort order, and stable player IDs. |
| Supabase migration | Two-user integration tests proving every user-owned table permits only `user_id = auth.uid()`. |
| UI state | Browser check for loading/error/preseason/no-results distinction, keyboard navigation, focus handling, and responsive layout. |
| Social/deployment | Deployed-page check for canonical URL, metadata, share image, and production error messaging. |

### 4. Implement the smallest coherent change

Prefer a narrow vertical slice. Do not add speculative flexibility or unrelated refactors. Extract pure logic only at a useful seam, such as fixture classification, player filters, FDR calculations, or persistence adapters. Preserve external behaviour unless the specification explicitly changes it.

### 5. Verify against the specification

Run the relevant automated tests, review the affected UI/data output, and compare the final diff to the stated acceptance criteria. Confirm that every material changed line traces to the approved change. Fix newly introduced lint, test, accessibility, or data-quality regressions before merging.

### 6. Record durable decisions

Update the project brief, an ADR, or a handoff document only when the decision will matter to a later task. Capture the decision, context, alternatives considered, and consequence. Do not turn routine implementation detail into permanent process documentation.

## Code-quality guardrails

| Principle | Apply it as follows |
|---|---|
| Think before coding | Surface ambiguity, conflicting requirements, and trade-offs early; do not silently choose product semantics. |
| Simplicity first | Solve the stated problem with the smallest maintainable design; avoid framework migrations or abstractions unless the specification requires them. |
| Surgical changes | Do not reformat, rename, or remove unrelated code while implementing a focused change. Mention separate cleanup opportunities instead. |
| Goal-driven execution | Translate requests into acceptance criteria with observable evidence. “Fix it” becomes a failing test, a verified repair, and a regression test. |
| Data over inference | Prefer an explicit source signal over a heuristic where a football fact is displayed to users. |
| Last known good | Do not publish invalid or partial data in place of a previously valid dataset without an explicit degraded-data policy. |

## Current delivery baseline

The initial production-readiness pass must complete before public X marketing. Its release gate is: no inferred BGWs, a correct preseason/no-results/error-state split, share metadata and a social image, and workflow failures that are visibly red. The Supabase migration follows only after the first test seams and stable player IDs exist.

## On-demand architecture mapping

Use an architecture or data-flow diagram when the data path, user-data boundary, or deployment model changes materially. The preferred scope is a single bounded view with 8–12 major components and an explicit trust boundary. The output must identify its source commit or document inputs and must not claim runtime facts that have not been verified.

Use [Archify][3] only as an optional, project-local diagram-generation aid. Store its source and exported artefacts under `docs/architecture/` when used. A Mermaid diagram is sufficient for simple static documentation.

## Suggested task prompt

> Follow `docs/agent-workflow/FPL-Engineering-Guide.md`. First produce a scoped specification and the required verification plan. Preserve all FPL invariants, especially that blank gameweeks are never inferred from absent fixture data. Implement only after the acceptance criteria are clear, then report the test and browser evidence.

## References

[1]: https://github.com/mattpocock/skills "mattpocock/skills"
[2]: https://github.com/multica-ai/andrej-karpathy-skills "multica-ai/andrej-karpathy-skills"
[3]: https://github.com/tt-a1i/archify "tt-a1i/archify"
