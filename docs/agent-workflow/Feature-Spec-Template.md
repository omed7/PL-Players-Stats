# Feature Specification — [Title]

**Status:** Draft | Approved | Implemented  
**Owner:** [Name]  
**Date:** YYYY-MM-DD  
**Related issue / PR:** [Link or `N/A`]

## 1. Outcome

Describe the user or operational problem in two or three sentences. State the observable outcome that will prove the change is useful.

> Example: “Visitors must see a clear season-not-started state when the valid FPL dataset has zero players because no player has recorded minutes. They must not interpret this valid condition as an empty filter result or a load failure.”

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| [Behaviour, view, data contract, or test seam included in this change.] | [Related improvement deliberately deferred.] |
|  |  |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
|---|---|---|---|
| Data source |  |  | Yes / No |
| Product behaviour |  |  | Yes / No |
| Security / privacy |  |  | Yes / No |
| Migration / compatibility |  |  | Yes / No |

Do not proceed when an open item controls data correctness, user privacy, credentials, or a visible product claim.

## 4. User journey and behaviour

Describe the primary flow in numbered steps. Include an error or unavailable-data flow when applicable.

1. [User/system starts in a known state.]
2. [User action or source event.]
3. [Expected response and visible outcome.]
4. [Fallback, validation, or terminal state.]

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
|---|---|---|---|
|  |  |  |  |

State every invariant that this change may touch. For fixture work, write explicitly whether the source can confirm a blank gameweek. **Absence from a source response is not confirmation.**

## 6. Technical design

Describe the smallest coherent design. Identify changed modules, extracted pure functions, persistence effects, and rollback/compatibility considerations.

| Component | Change | Reason | Test seam |
|---|---|---|---|
|  |  |  |  |

## 7. Acceptance criteria

Write outcomes that a reviewer can verify. Each criterion needs a corresponding test or a reproducible manual/browser check.

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 |  | Unit / integration / browser / deployed preview |  |
| AC-2 |  |  |  |
| AC-3 |  |  |  |

## 8. Test plan

List expected failing tests before implementation and the final verification command or procedure. For Supabase work, include a two-user RLS test. For deployed UI work, include an accessible keyboard check and a deployed-preview check.

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Happy path |  |  |  |
| Boundary / empty state |  |  |  |
| Source failure / malformed data |  |  |  |
| Regression case |  |  |  |

## 9. Release and observability

Describe any data refresh, migration, environment variable, deployment, cache, social metadata, monitoring, or communication step needed for safe release. State the rollback path.

## 10. Completion record

| Check | Result | Link / evidence |
|---|---|---|
| Tests pass |  |  |
| Browser/manual verification complete |  |  |
| Accessibility check complete |  |  |
| Data invariants reviewed |  |  |
| Deployment/release check complete |  |  |
| Durable documentation updated if needed |  |  |

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
|  |  |  |  |
