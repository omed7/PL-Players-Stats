# Phase 7A Public Data Foundation Verification

**Date:** 2026-08-19
**Supabase project:** `fpl-omed` (`ghowrpjnoraohyjpmvuo`)
**Repository migration:** `supabase/migrations/20260819054600_create_public_data_foundation.sql`
**Repository pull request:** [#53](https://github.com/omed7/PL-Players-Stats/pull/53)

## Scope completed

The approved additive migration was merged through pull request #53 and then applied successfully to the existing Supabase project. It creates the database foundation for Supabase-first public FPL snapshots without changing the browser data source, enabling authentication UI, adding SMTP, creating an ingestion secret, or choosing a scheduler.

| Component | Live result |
| --- | --- |
| `public.fpl_sync_runs` | Created with lifecycle status checks, source metadata, failure metadata, RLS, and no `anon`/`authenticated` grants or policy. |
| `public.fpl_published_snapshots` | Created with schema-v1/v2 checks, versioning, payload checks, a one-current-snapshot partial unique index, RLS, and public select limited to current rows. |
| `public.current_fpl_snapshot` | Created as a security-invoker public projection of the current validated snapshot only. |
| Existing account tables | `profiles`, `user_preferences`, and `watchlist_items` remain present and RLS-enabled. |

## Live validation evidence

| Check | Result |
| --- | --- |
| Supabase migration application | Successful. |
| Live table inventory | Both new tables exist and are RLS-enabled; existing account tables remain RLS-enabled. |
| RLS policy inventory | The only public-data policy is `fpl_published_snapshots_select_current`, for `SELECT` by `anon` and `authenticated` where `is_current`. |
| Current public projection | Empty (`[]`) because no validated server-side snapshot has been ingested. |
| Security advisor | One **INFO** `rls_enabled_no_policy` finding on `fpl_sync_runs`; this is expected for a server-only, deny-by-default metadata table with no browser-facing grant or policy. |
| Repository CI | Pull request #53 passed the full regression workflow before merge. |

## Security and operational boundary

The public snapshot table is deliberately readable only through a current-row condition. Sync-run metadata is deliberately inaccessible through browser-facing roles. No mutation policy was granted to `anon` or `authenticated`, and no service-role key, Supabase secret, Vercel environment value, browser configuration, or scheduler credential was created.

Secure ingestion remains deliberately deferred. The pending user-controlled operational decision is whether a server-side scheduler will be implemented with a GitHub Actions secret, a managed Supabase schedule/function, or a managed backend. Until then, the deployed browser continues to use the existing static `players.json` path and no empty database result can replace the last known good public snapshot.

## References

[1]: https://github.com/omed7/PL-Players-Stats/pull/53 "Pull request #53: public FPL snapshot foundation"
[2]: https://supabase.com/docs/guides/database/postgres/row-level-security "Supabase Row Level Security guidance"
