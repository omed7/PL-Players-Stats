# Feature Specification — Accessibility Baseline

**Status:** Approved for implementation
**Owner:** Manus AI
**Date:** 2026-08-19
**Related issue / PR:** N/A

## 1. Outcome

Keyboard and assistive-technology users must be able to understand and operate the current FPL Omed controls without relying on visual symbols or pointer-only interaction. The observable outcome is that icon-only actions have accessible names, the watchlist and modal interactions follow a predictable focus lifecycle, and player-table sorting is operable with the keyboard and exposes its current direction.

## 2. Scope and non-goals

| In scope | Explicitly out of scope |
| --- | --- |
| Accessible names for icon-only header, row, drawer, comparison, and player-detail controls. | A full WCAG audit, color-contrast redesign, or visual-system rewrite. |
| Semantic dialog attributes, Escape behavior, focus trapping, and focus restoration for the watchlist drawer and both modals. | New account, authentication, SMTP, Supabase client, or database work. |
| Native keyboard-operable sort controls and `aria-sort` state for the player table. | Changes to sorting semantics, data contracts, filters, fixtures, or FPL statistics. |
| A visible keyboard-focus treatment and local browser smoke checks. | A post-launch assistive-technology usability study. |

## 3. Assumptions and decisions

| Topic | Decision or assumption | Evidence / owner | Open? |
| --- | --- | --- | --- |
| Dialog behavior | The watchlist drawer and existing overlays act as modal interactions while open; focus will be retained inside and restored to the invoking control when closed. | Existing backdrop and body-scroll behavior; implementation decision. | No |
| Sorting | Sort headers will use native buttons rather than pointer-only clickable table cells, preserving existing sort direction and default column. | Current player-table header implementation. | No |
| Data/privacy | This change does not read, write, transmit, or alter FPL, local-persistence, or Supabase data. | Scoped non-goal. | No |
| Browser support | The baseline uses standard DOM focus, key, and ARIA APIs already supported by the target evergreen browsers. | Existing static-browser application architecture. | No |

## 4. User journey and behaviour

1. A keyboard user tabs to a visible action and receives an accessible name that explains the action rather than only a glyph.
2. When the user opens the watchlist, comparison, or player-detail interaction, focus moves to a meaningful control within that interaction and does not escape with Tab or Shift+Tab.
3. Escape or a close action returns focus to the control that opened the interaction. Clicking an existing backdrop retains its established close behavior and also restores focus.
4. A keyboard user activates a table sort button with Enter or Space. The active column communicates `ascending` or `descending`; all other sortable headers communicate `none`.

## 5. Data contract and invariants

| Field / entity | Source | Required rule | Failure/degraded behaviour |
| --- | --- | --- | --- |
| FPL player and fixture data | Existing `players.json` path | No schema, filter, timeframe, fixture, or FPL-statistic behavior changes. | Existing loading, error, preseason, and no-results states remain unchanged. |
| Local watchlist data | Existing `fpl_watchlist_v2` storage | Accessibility actions must use the existing stable `element_id` path. | Existing watchlist behavior remains intact. |
| Dialog focus state | In-memory browser state | Stores only the initiating DOM element during an active interaction. | If the invoker is disconnected, closing leaves focus at the document’s normal position without throwing. |

## 6. Technical design

| Component | Change | Reason | Test seam |
| --- | --- | --- | --- |
| `index.html` | Add dialog labels/roles, accessible names, and native sort buttons. | Provides semantic names and keyboard-native controls. | DOM attributes and local browser keyboard check. |
| `script.js` | Centralize modal focus open/close, Escape, Tab containment, and sort-button event handling. | Preserves the existing interaction design while enforcing predictable focus behavior. | Focus lifecycle browser check and existing regression suite. |
| `style.css` | Add a visible `:focus-visible` treatment and preserve existing visual hierarchy. | Makes keyboard position visible without persistent pointer focus rings. | Local browser keyboard check. |

## 7. Acceptance criteria

| ID | Acceptance criterion | Verification method | Evidence |
| --- | --- | --- | --- |
| AC-1 | Every icon-only control has a meaningful accessible name. | DOM inspection and local browser check. | Pending implementation. |
| AC-2 | Watchlist, comparison, and player-detail interactions expose dialog semantics, move focus inside on open, trap Tab navigation, close on Escape, and restore focus to a connected invoker. | Local browser keyboard smoke test. | Pending implementation. |
| AC-3 | Player-table sorting uses keyboard-operable native controls and updates `aria-sort` to reflect the active direction. | Keyboard smoke test and DOM inspection. | Pending implementation. |
| AC-4 | The baseline does not alter player-data rendering or the existing loading/error/preseason/no-results distinction. | `npm test` and local browser state checks. | Pending implementation. |

## 8. Test plan

| Scenario | Expected pre-change result | Expected final result | Test level |
| --- | --- | --- | --- |
| Icon-only control | Glyph/title only in several controls. | Explicit `aria-label` or visible text-equivalent name. | DOM/browser |
| Open and close interaction | Focus remains wherever it was; Escape handles only player detail. | Focus moves into each interaction, traps, closes on Escape, and restores. | Browser |
| Sort with keyboard | Header cells are pointer-clickable only. | Native button activation works with Enter/Space and updates `aria-sort`. | Browser |
| Existing data states | Existing regression behavior. | Unchanged. | Automated regression |

## 9. Release and observability

This is a static frontend-only change with no migration, environment variable, cache, data refresh, or credential requirement. The rollback path is a standard pull-request revert. The change will be released through the existing Vercel deployment triggered by a merged passing pull request.

## 10. Completion record

| Check | Result | Link / evidence |
| --- | --- | --- |
| Tests pass | Pending | `npm test` after implementation. |
| Browser/manual verification complete | Pending | Local keyboard smoke record after implementation. |
| Accessibility check complete | Pending | Acceptance-criteria verification. |
| Data invariants reviewed | Pending | Scope review against existing regression tests. |
| Deployment/release check complete | Pending | Vercel deployment check after merge. |
| Durable documentation updated if needed | Complete | This specification. |

## Decision log

| Date | Decision | Rationale | Consequence |
| --- | --- | --- | --- |
| 2026-08-19 | Use native sort buttons and a small shared dialog-focus helper. | Native controls reduce custom keyboard handling while a shared helper avoids inconsistent modal behavior. | The change remains narrow and preserves current sort/data logic. |
