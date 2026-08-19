-- Phase 7A: Supabase-first public FPL data foundation
--
-- This migration is additive. It keeps public operational data isolated from the
-- existing owner-only account tables and deliberately provides no public mutation
-- route. Privileged ingestion remains deferred until a server-side credential and
-- scheduler are explicitly selected.

begin;

create table public.fpl_sync_runs (
  id bigint generated always as identity primary key,
  status text not null check (status in ('started', 'published', 'failed')),
  schema_version integer not null check (schema_version in (1, 2)),
  source_fetched_at timestamptz,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  eligible_player_count integer check (eligible_player_count is null or eligible_player_count >= 0),
  published_player_count integer check (published_player_count is null or published_player_count >= 0),
  source_metadata jsonb not null default '{}'::jsonb check (jsonb_typeof(source_metadata) = 'object'),
  error_message text,
  created_at timestamptz not null default now(),
  check (
    completed_at is null
    or completed_at >= started_at
  ),
  check (
    (status = 'started' and completed_at is null and error_message is null)
    or (status = 'published' and completed_at is not null and error_message is null)
    or (status = 'failed' and completed_at is not null and error_message is not null)
  )
);

create table public.fpl_published_snapshots (
  id bigint generated always as identity primary key,
  sync_run_id bigint not null references public.fpl_sync_runs(id) on delete restrict,
  snapshot_version bigint not null unique,
  schema_version integer not null check (schema_version in (1, 2)),
  fetched_at timestamptz not null,
  player_count integer not null check (player_count >= 0),
  payload_hash text not null check (char_length(payload_hash) > 0),
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  is_current boolean not null default false,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create unique index fpl_published_snapshots_one_current_idx
  on public.fpl_published_snapshots (is_current)
  where is_current;

create index fpl_sync_runs_status_started_at_idx
  on public.fpl_sync_runs (status, started_at desc);

create index fpl_published_snapshots_published_at_idx
  on public.fpl_published_snapshots (published_at desc);

alter table public.fpl_sync_runs enable row level security;
alter table public.fpl_published_snapshots enable row level security;

revoke all on table public.fpl_sync_runs from anon, authenticated;
revoke all on table public.fpl_published_snapshots from anon, authenticated;

-- The browser can read a current, validated public snapshot only. It receives no
-- policy or grant for sync metadata, historic snapshots, or any mutation action.
grant select on table public.fpl_published_snapshots to anon, authenticated;

create policy "fpl_published_snapshots_select_current"
on public.fpl_published_snapshots
for select
to anon, authenticated
using (is_current);

create view public.current_fpl_snapshot
with (security_invoker = true)
as
select
  snapshot_version,
  schema_version,
  fetched_at,
  player_count,
  payload_hash,
  payload,
  published_at
from public.fpl_published_snapshots
where is_current;

revoke all on table public.current_fpl_snapshot from anon, authenticated;
grant select on table public.current_fpl_snapshot to anon, authenticated;

comment on table public.fpl_sync_runs is
  'Server-side ingestion lifecycle metadata. No browser or authenticated-user grants.';
comment on table public.fpl_published_snapshots is
  'Versioned validated FPL payloads. RLS exposes only the single current snapshot.';
comment on view public.current_fpl_snapshot is
  'Public read-only projection of the current validated FPL snapshot.';

commit;
