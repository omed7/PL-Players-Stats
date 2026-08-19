# Feature Specification — Stable-ID Local Persistence

**Status:** Approved for implementation
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

Watchlist and comparison state will use FPL `element_id` values rather than mutable display names. Existing browser watchlists saved under the legacy name-based key will migrate once when a current player snapshot resolves every saved name uniquely. The visible watchlist and comparison behavior remains unchanged.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| Store watchlist IDs under a versioned local-storage key. | Supabase Auth, cloud sync, or public account UI. |
| Migrate safely resolvable legacy name entries without deleting unresolved entries. | Rewriting the public FPL data source in this release. |
| Use element IDs in all table, drawer, filter, comparison, and event consumers. | Changing the maximum of three comparison selections. |
| Test migration, invalid storage, duplicate names, and element-ID lookup behavior. | Backfilling historic local storage in remote browsers. |

## 3. Decisions

| Topic | Decision | Open? |
|---|---|---|
| New watchlist key | `fpl_watchlist_v2`, storing positive integer `element_id` values. | No |
| Legacy key | Read `fpl_watchlist_v1` only during migration; leave it intact until a complete migration succeeds. | No |
| Migration condition | Migrate only if every legacy stored display name maps to exactly one current player `element_id`. | No |
| Ambiguous/unresolved names | Preserve the legacy key and do not create a partial v2 list. | No |
| Comparison selection | Keep it session-only but store `element_id` values in `state.compareSet`. | No |
| Missing IDs in a legacy snapshot | Do not migrate; existing state remains empty rather than inventing an identity. | No |

## 4. User behavior

1. On a normal current schema-v2 snapshot, a visitor stars a player and the browser persists its `element_id` under the v2 key.
2. A visitor with a legacy name watchlist loads a current player snapshot. If all saved names resolve uniquely, the browser creates the v2 list and the same player cards remain starred.
3. If any legacy name is ambiguous or no longer present, the browser leaves the v2 key absent and retains the legacy key for a future compatible snapshot rather than silently losing or misassigning a favorite.
4. Watchlist-only filtering, drawer removal, table stars, comparison chips, and comparison modal all resolve players by `element_id`.

## 5. Data contract and invariants

| Entity | Required rule | Failure/degraded behavior |
|---|---|---|
| Watchlist ID | Positive integer FPL `element_id`. | Ignore malformed v2 entries. |
| Legacy name | Must resolve to exactly one player in the current snapshot. | Preserve legacy storage; do not partially migrate. |
| Player map | Built from `element_id`; invalid/missing IDs are excluded. | Current UI remains usable but no identity migration occurs. |
| Comparison state | At most three valid `element_id` values. | Missing players are omitted from visual output. |
| Display name | Render-only; never a persistence or lookup key. | No durable identity is inferred from text. |

## 6. Technical design

| Component | Change | Test seam |
|---|---|---|
| `persistence_utils.js` | Pure ID normalization, player index, and atomic legacy-watchlist migration helper. | Jest unit tests. |
| `script.js` | Load/save v2 IDs, migrate after player load, and replace name lookups/data attributes with IDs. | Browser smoke test and controller review. |
| `index.html` | Load the pure persistence utility before the controller. | Page script order inspection. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method |
|---|---|---|
| AC-1 | Newly saved watchlist entries are positive `element_id` values only. | Jest unit test and browser storage inspection. |
| AC-2 | A fully resolvable legacy name list migrates to exactly the expected unique IDs. | Jest unit test. |
| AC-3 | Duplicate, unresolved, malformed, or partially resolvable legacy lists do not create a partial v2 watchlist. | Jest unit tests. |
| AC-4 | Watchlist, comparison, drawer removal, and watchlist-only filtering use IDs, not names. | Source review and browser smoke test. |
| AC-5 | The full JS/Python test suite and PR workflow pass before merge. | `npm test` and GitHub Actions. |

## 8. Release and rollback

The migration is additive and local to each browser. The legacy key is retained, so rollback is a source revert and does not destroy the original name list. A later authenticated Supabase migration will use these same `element_id` values for safe cloud merge.
