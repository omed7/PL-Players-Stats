# Feature Specification — Phase 5: Match History and Custom-FDR Data Contracts

**Status:** Approved for history-contract implementation; Custom FDR remains deferred until SMTP-enabled accounts
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

FPL Omed will expand its player dataset so future form and venue views can calculate a player’s most recent **matches** accurately across the full current season. A match-level history record must retain venue, fixture, opponent, and completed-match context rather than serialising only the latest ten rows without venue data. Custom FDR will remain a documented future account feature, while Official FPL difficulty stays the sole public fixture rating.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
|---|---|
| A versioned match-history payload that preserves all relevant completed current-season player-match rows. | Public account sign-in, magic links, or preference sync while SMTP remains deferred. |
| Stable match identifiers, venue, opponent team ID, gameweek, completion state, and existing player performance fields. | User-editable Custom FDR UI or persistence. |
| Pure match-selection rules for overall and venue-first last-N calculations. | A misleading “Last N GWs” label for player-history slices. |
| Documentation for the future Custom FDR ownership, rating, and fallback contract. | Historical seasons, external fixture feeds, or inferred blank-gameweek labels. |
| A migration path from the current ten-row `gw_history` data shape. | A broad front-end redesign beyond the first history consumer. |

## 3. Approved decisions

| Topic | Decision | Evidence / owner | Open? |
|---|---|---|---|
| Timeframe unit | **Last 3 / Last 5 / Last 10** means a player’s most recent completed **matches**. | User-approved recommended semantics, 2026-08-19. | No |
| Double gameweeks | Each completed fixture counts as one match; a double gameweek can therefore contribute two matches. | Consequence of match-based timeframe semantics. | No |
| Venue-first selection | For Home or Away form, filter completed history to that venue first, then select the latest N matching records. | User-approved recommended semantics. | No |
| Season split input | Preserve completed current-season raw rows, including zero-minute rows, so selection and availability remain transparent. | User-approved recommended semantics. | No |
| Current history limit | The existing `gw_history[-10:]` output is insufficient for venue-first last-N calculations and must be superseded. | Current fetcher source evidence. | No |
| Custom FDR default | Official FPL difficulty is the only public mode until authenticated preferences can be released. | SMTP/account deferral decision. | No |
| Custom FDR ownership | Future ratings are private, keyed by `(user_id, season, team_id, venue)`, and require RLS. | FPL account invariant. | No |
| Missing custom ratings | Future custom-mode UI must fall back to Official FPL difficulty or explicitly mark a rating incomplete; it must never invent one. | Data-truthfulness invariant. | No |

## 4. User-visible semantics

1. A future control labelled **Last 5 Matches** selects the five most recent completed player-match records, ordered by kickoff time and then fixture ID. It does not claim to represent five gameweeks.
2. A future **Home — Last 5 Matches** view first retains only completed home records, then selects the latest five of those home records. Away follows the same rule.
3. A full-season view includes all completed current-season records. A player who was selected but did not play remains a zero-minute match record in the raw contract; presentation layers may state the number of appearances separately.
4. Current upcoming fixtures remain separate from completed history. Missing upcoming data remains **unknown**, not a confirmed blank gameweek.
5. Official FPL difficulty remains the public FDR value. Custom ratings are not rendered until a user can authenticate and own the associated data.

## 5. Versioned data contract

The root dataset gains an explicit `schema_version` value. Consumers must treat a missing or unsupported version as unavailable rather than guessing the meaning of a field. The initial expanded schema version is `2`.

| Field / entity | Source | Required rule | Failure / degraded behaviour |
|---|---|---|---|
| `schema_version` | Fetcher output | Integer `2` once full history is released. | UI keeps the existing supported presentation or reports incompatible data; never mislabels rows. |
| `match_history` | FPL element-summary history | Array of completed current-season player-match records, sorted ascending by kickoff time/fixture ID in output. | Missing history stays unavailable; it is not a blank gameweek. |
| `fixture_id` | Source `fixture` field | Positive fixture identifier used as the stable match key. | Skip/fail invalid source record according to fetch completeness policy. |
| `gw` | Source `round` field | Informational gameweek grouping only; never the unit used by match-timeframe selection. | Preserve `null`/unknown source state without inventing a gameweek. |
| `opponent_team_id` | Source `opponent_team` field | Positive numeric FPL team ID. | Record validation fails for invalid ID. |
| `was_home` | Source `was_home` field | Boolean venue fact used for the Home/Away filter. | Record validation fails for absent/non-boolean venue state. |
| `kickoff_time` | Source `kickoff_time` field | ISO timestamp used for deterministic sort order. | If unavailable, use fixture ID only as documented secondary ordering; do not infer chronology. |
| `minutes` | Source history field | Preserve `0` as a valid completed player-match outcome. | Do not omit a zero-minute row merely to improve form statistics. |
| Existing performance fields | Source history field | Preserve points, xG, xA, xGI, bonus, influence, creativity, threat, ICT, BPS, saves, defensive contribution, goals, assists, and clean-sheet values. | Use current safe numeric conversion; fail visibly on schema-invalid source. |

### Required `match_history` record shape

```json
{
  "fixture_id": 123,
  "gw": 7,
  "opponent_team_id": 10,
  "was_home": true,
  "kickoff_time": "2026-10-03T14:00:00Z",
  "minutes": 90,
  "pts": 8,
  "xG": 0.42,
  "xA": 0.17,
  "xGI": 0.59,
  "goals": 1,
  "assists": 0,
  "clean_sheets": 0,
  "bonus": 2,
  "influence": 38.4,
  "creativity": 19.2,
  "threat": 42.0,
  "ict": 9.9,
  "bps": 27,
  "saves": 0,
  "defcon": 6
}
```

## 6. Match-selection contract

The selection helper must be pure, browser-compatible, and independent of table/modal rendering. It receives an array of validated completed `match_history` records, an optional venue (`all`, `home`, or `away`), and positive N.

| Case | Required behaviour |
|---|---|
| Overall last N | Sort completed records by `kickoff_time` then `fixture_id`, select the most recent N, and preserve chronological order for chart/table output. |
| Home/Away last N | Filter by `was_home` before applying the same sort and N selection. |
| Fewer than N records | Return all matching records and expose the returned count; do not pad with fabricated matches. |
| Zero-minute records | Include them as completed matches. UI layers may calculate appearances separately using `minutes > 0`. |
| Postponed/unplayed fixtures | Exclude them from completed `match_history`; retain no claim that the absence is a blank gameweek. |
| Invalid record | Reject it at fetch validation. Do not silently create a partial match sequence. |
| Double gameweek | Treat each fixture record separately. The UI label remains **matches**. |

## 7. Future Custom-FDR contract

No Custom-FDR table is applied in this increment because the feature is user-owned and SMTP-enabled account access is deferred. The following future contract is binding when authentication resumes.

| Entity / field | Required future rule |
|---|---|
| `custom_fdr_ratings.user_id` | Authenticated Supabase UUID. Every policy uses `auth.uid() = user_id`. |
| `season` | Explicit season identifier such as `2026-27`; ratings do not silently carry across promotion/relegation changes. |
| `team_id` | Numeric FPL team ID, never a name or abbreviation. |
| `venue` | Constrained to `home` or `away`. A neutral/both value must be calculated in code rather than stored ambiguously. |
| `rating` | Integer constrained to the chosen Official-compatible scale, initially `1`–`5`. |
| Primary key | `(user_id, season, team_id, venue)` to prevent duplicate ratings. |
| Default presentation | Official FPL difficulty, explicitly labelled **Official**. |
| Custom-mode fallback | Use Official difficulty for an unconfigured row and label the fallback, or mark it incomplete. |

## 8. Technical design

| Component | Change | Reason | Test seam |
|---|---|---|---|
| `fpl_fetcher.py` | Build validated full-season `match_history` records, preserve legacy `gw_history` temporarily, and emit `schema_version: 2`. | Retains all data needed for correct match and venue slicing. | Python unit tests for record construction and sorting input. |
| `history_utils.js` | Introduce pure selection and aggregation helpers. | Allows tested overall/home/away last-N behaviour independent of UI. | Jest unit tests. |
| `script.js` | Do not change existing labels until a history consumer is implemented. When added, use **Matches**, not **GWs**. | Avoids a partial UI claim before data support is live. | Browser check after a vertical consumer slice. |
| `players.json` | Add versioned history only after fetcher validation passes. | Client and source data evolve together. | Fetcher workflow plus snapshot check. |
| `supabase/migrations/` | No Custom-FDR migration in this increment. | Prevents unused user-owned storage without sign-in/RLS integration tests. | Deferred account-phase test. |

## 9. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
|---|---|---|---|
| AC-1 | The fetcher emits `schema_version: 2` and each eligible player contains full validated completed `match_history`. | Python test plus generated snapshot inspection. | Test output and fixture sample. |
| AC-2 | A double gameweek produces two separate records and both can be included in a match-based last-N window. | JavaScript and Python unit test. | Test output. |
| AC-3 | Venue-first selection returns the most recent N home or away records, not the home/away subset of an already-selected global N. | Jest unit test. | Test output. |
| AC-4 | Zero-minute completed records remain present in raw history. | Python unit test. | Test output. |
| AC-5 | Missing or delayed upcoming fixture data is not transformed into a historical record or a `BGW` label. | Existing fixture regression suite plus fetcher test. | Test output. |
| AC-6 | No public Custom-FDR control or rating table is introduced while SMTP-enabled accounts remain deferred. | Repository review. | Diff review. |

## 10. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
|---|---|---|---|
| Normal match sequence | Only aggregate last-five/last-ten and last ten serialised rows. | Complete validated raw history supports match selection. | Python + Jest |
| Double gameweek | Potentially misleading gameweek terminology. | Two distinct fixtures count as two matches. | Python + Jest |
| Last five away | Cannot safely extend beyond ten global rows. | Venue filter runs before selection across full history. | Jest |
| Zero-minute team match | May be omitted by limited presentation logic. | Raw completed fixture row remains available. | Python |
| Unknown future fixture | Risk of interpretation as missing/blank slot. | Remains upcoming-data unknown and separate from completed history. | Existing fixture tests |
| Unsupported schema version | No defined behaviour. | Consumer fails visibly or stays on an explicitly supported path. | Unit/browser after consumer is added |

## 11. Release and rollback

The history contract is released only when the fetcher validates all active-player history responses and `npm test` passes. The CI workflow remains the release gate. A client that does not yet consume `match_history` remains backward-compatible with the legacy fields, while newly added history controls must require `schema_version: 2`.

Rollback is a source rollback to the prior fetcher/schema release and preserves the previous valid `players.json` under the existing atomic-write policy. The Custom-FDR schema and UI remain deferred; no authentication, SMTP, or user-data setting changes in this increment.

## Decision log

| Date | Decision | Rationale | Consequence |
|---|---|---|---|
| 2026-08-19 | Last N is match-based, not gameweek-based. | A double gameweek contains multiple player matches and must not create a misleading timeframe claim. | New consumers use the word **Matches**. |
| 2026-08-19 | Venue filtering occurs before last-N selection. | “Last five away matches” must be able to look beyond the player’s five latest overall matches. | Full season raw match history is required. |
| 2026-08-19 | Retain zero-minute completed rows in raw history. | Data availability and appearance statistics must remain distinguishable. | UI aggregates can separately report appearances. |
| 2026-08-19 | Keep Custom FDR deferred until accounts exist. | Ratings are private user-owned state and require authenticated RLS validation. | Official FDR stays the public default. |
