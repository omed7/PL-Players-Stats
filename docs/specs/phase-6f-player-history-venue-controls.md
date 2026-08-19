# Feature Specification — Player History Venue Controls

**Status:** Approved for implementation
**Owner:** Manus AI
**Date:** 2026-08-19

## Outcome

Visitors can choose **All venues**, **Home**, or **Away** and a recent-match count in the player detail history. The chart and match log must refresh from the same selected sequence, with the venue filter applied before the final N-match selection.

## Scope and non-goals

| In scope | Out of scope |
| --- | --- |
| Player-detail controls for All/Home/Away and Last 5/Last 10 Matches when schema-v2 match history is available. | Changing main dashboard aggregate timeframe metrics. |
| Shared venue-first selection for the chart and match log. | Inferring blank gameweeks, changing fixture data, or adding FDR logic. |
| Zero-minute completed match retention and double-fixture counting through the existing match utility. | Venue-split aggregate main-table statistics. |

## Required invariants

| Invariant | Required behaviour |
| --- | --- |
| Timeframe label | Use **Matches**, never gameweeks, for last-N controls and headings. |
| Venue ordering | Filter by venue before taking the most recent N completed matches. |
| Completed rows | Retain valid completed zero-minute matches. |
| Double fixtures | Count each valid fixture as one match, including two in the same gameweek. |
| Unknown data | Do not infer missing fixture or blank-gameweek information. |

## Technical design and verification

The existing `selectRecentMatches(history, { venue, limit })` utility remains the sole selection path. The player-detail modal stores the active venue and count for its open session, then rerenders its history-only section from that utility without changing player data or global filters. Existing utility tests already cover venue-first selection, double fixtures, and zero-minute rows; browser verification will confirm the controls and history heading use match labels.
