# Feature Specification — Test Coverage and Dependency Hardening

**Status:** Approved for implementation
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

The project must have a direct regression seam for its distinct dashboard states and broader schema-compatibility edge cases, while its Jest development dependency tree must no longer report the known high- and low-severity audit findings. The observable outcome is a green JavaScript/Python suite and a zero-advisory full dependency audit after the lockfile and direct Jest packages are updated.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
| --- | --- |
| Extract and test a small pure dashboard-state classifier for error, preseason, no-results, and ready states. | Redesigning loading, error, preseason, or no-results copy and presentation. |
| Add edge-case tests for schema compatibility classification. | Supporting a new public player-data schema or changing the existing v1/v2 contract. |
| Update `jest` and `jest-environment-jsdom` within their current major release and refresh the lockfile. | Introducing runtime dependencies or changing the static deployment bundle. |
| Verify `npm audit` reports no remaining advisories. | Treating development-only audit findings as production-runtime defects. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
| --- | --- | --- | --- |
| Audit scope | The initial full audit reported one low and three high advisories in Jest’s transitive development tree; the production-only audit reported zero. | Local `npm audit` on 2026-08-19. | No |
| Remediation | Upgrade direct Jest packages to currently available compatible 30.4.x releases and regenerate the lockfile; do not force a major change. | Local `npm outdated` reported Jest 30.4.x candidates. | No |
| UI behavior | Preserve current error, preseason, no-results, and ready conditions exactly; expose them through a pure classifier for focused tests. | Existing `renderTable()` branches. | No |
| Data/privacy | No FPL, local-storage, account, Supabase, SMTP, or credential behavior changes. | Scoped non-goal. | No |

## 4. User journey and behaviour

1. When data rendering is evaluated, the application classifies the state as error, preseason, no-results, or ready using the existing precedence and player counts.
2. The existing table continues to display its current message only for error, valid preseason, or no-results states; a ready state renders player rows.
3. Developers run the existing `npm test` command and receive expanded focused coverage for UI state and schema boundaries.
4. Developers run `npm audit` and the updated development tree reports zero advisories.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
| --- | --- | --- | --- |
| `players.json` schema | Existing static data pipeline | Preserve acceptance of legacy arrays and documented schema versions 1 and 2 only. | Incompatible or malformed payloads remain rejected through the established error path. |
| Dashboard state inputs | Existing `state.loadError`, filtered player count, and preseason determination | Preserve existing precedence: error before preseason before no-results before ready. | Existing user-visible messages remain unchanged. |
| Package dependency tree | `package.json` and lockfile | Maintain Jest 30.x compatibility and remove known audit findings. | A failing test or non-zero advisories blocks merge. |

## 6. Technical design

| Component | Change | Reason | Test seam |
| --- | --- | --- | --- |
| `ui_state_utils.js` | Add a pure dashboard-state classifier exported for browser and Jest use. | Makes existing table-state precedence directly testable. | Focused Jest state matrix. |
| `script.js` | Use the classifier in the existing empty-table branch only. | Avoids duplicate conditional behavior. | Existing regression suite and local browser state. |
| `schema_utils.test.js` | Add malformed and unsupported-envelope boundary cases. | Protects the explicit v1/v2 compatibility contract. | Focused Jest tests. |
| `package.json` / lockfile | Update direct Jest packages within 30.x. | Pulls patched transitive development dependencies. | `npm test`, `npm audit`. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
| --- | --- | --- | --- |
| AC-1 | A pure dashboard-state classifier returns error, preseason, no-results, and ready using the established precedence. | Jest unit test matrix. | Pending implementation. |
| AC-2 | The existing empty-table branch uses that classifier without changing current user-facing state messages. | Code review, Jest, local browser verification. | Pending implementation. |
| AC-3 | Schema tests cover malformed envelopes and unsupported version values without accepting them. | Jest tests. | Pending implementation. |
| AC-4 | The full `npm audit` and production-only audit both report zero advisories after the Jest 30.x update. | Package-manager audit commands. | Pending implementation. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
| --- | --- | --- | --- |
| Error with zero players | Inline `renderTable()` branch. | Classifier returns `error`; message unchanged. | Unit + browser |
| Valid preseason zero-player output | Inline `renderTable()` branch. | Classifier returns `preseason`; message unchanged. | Unit + browser |
| Filtered non-preseason empty output | Inline `renderTable()` branch. | Classifier returns `no_results`; message unchanged. | Unit |
| Non-empty data | No empty-state message. | Classifier returns `ready`; rows continue rendering. | Unit |
| Unsupported schema envelope | Existing rejection behavior. | Explicit test verifies rejection. | Unit |
| Dependency graph | One low and three high development advisories. | Zero full and production-only advisories. | Dependency audit |

## 9. Release and observability

This task changes development dependencies and frontend test seams only. It requires no migration, environment variable, data refresh, connector, secret, cache action, or deployment configuration. The rollback path is a standard pull-request revert; the deployed static application has no runtime package bundle dependency.

## 10. Completion record

| Check | Result | Link / evidence |
| --- | --- | --- |
| Tests pass | Pending | `npm test` after implementation. |
| Browser/manual verification complete | Pending | Local dashboard-state check after implementation. |
| Accessibility check complete | Not applicable | No interactive behavior change intended. |
| Data invariants reviewed | Pending | Schema/UI-state test evidence. |
| Deployment/release check complete | Pending | Existing Vercel deployment after merge. |
| Durable documentation updated if needed | Complete | This specification. |

## Decision log

| Date | Decision | Rationale | Consequence |
| --- | --- | --- | --- |
| 2026-08-19 | Remediate known audit findings through compatible direct Jest 30.x updates rather than a forced major upgrade. | The audit path is development-only and `npm outdated` offers compatible 30.4.x releases. | The change remains narrow and testable. |
