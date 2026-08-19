-- Phase 7B: atomic GitHub Actions publication RPC
--
-- This function is callable only with the Supabase service role supplied to the
-- GitHub Actions runtime. It is not a browser API and has no anon/authenticated
-- execute grant.

begin;

create or replace function public.publish_fpl_snapshot(
  p_payload jsonb,
  p_payload_hash text,
  p_fetched_at timestamptz,
  p_player_count integer,
  p_source_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_run_id bigint;
  v_current_hash text;
  v_current_version bigint;
  v_next_version bigint;
begin
  if jsonb_typeof(p_payload) <> 'object' then
    raise exception 'FPL payload must be a JSON object';
  end if;
  if p_payload ->> 'schema_version' <> '2' then
    raise exception 'FPL payload must use schema version 2';
  end if;
  if jsonb_typeof(p_payload -> 'players') <> 'array' then
    raise exception 'FPL payload must include a players array';
  end if;
  if p_payload_hash is null or char_length(p_payload_hash) = 0 then
    raise exception 'FPL payload hash is required';
  end if;
  if p_fetched_at is null then
    raise exception 'FPL fetched_at is required';
  end if;
  if p_player_count is null or p_player_count < 0 then
    raise exception 'FPL player count must be non-negative';
  end if;
  if jsonb_array_length(p_payload -> 'players') <> p_player_count then
    raise exception 'FPL player count does not match payload';
  end if;
  if jsonb_typeof(p_source_metadata) <> 'object' then
    raise exception 'FPL source metadata must be a JSON object';
  end if;

  -- Serializes publishers so the partial unique current-snapshot index remains
  -- valid throughout the deactivate-and-publish transition.
  perform pg_advisory_xact_lock(21092026);

  select payload_hash, snapshot_version
  into v_current_hash, v_current_version
  from public.fpl_published_snapshots
  where is_current
  for update;

  insert into public.fpl_sync_runs (
    status,
    schema_version,
    source_fetched_at,
    eligible_player_count,
    published_player_count,
    source_metadata
  ) values (
    'started',
    2,
    p_fetched_at,
    p_player_count,
    p_player_count,
    p_source_metadata
  )
  returning id into v_run_id;

  if v_current_hash = p_payload_hash then
    update public.fpl_sync_runs
    set status = 'published', completed_at = now()
    where id = v_run_id;

    return jsonb_build_object(
      'published', false,
      'snapshot_version', v_current_version
    );
  end if;

  update public.fpl_published_snapshots
  set is_current = false
  where is_current;

  select coalesce(max(snapshot_version), 0) + 1
  into v_next_version
  from public.fpl_published_snapshots;

  insert into public.fpl_published_snapshots (
    sync_run_id,
    snapshot_version,
    schema_version,
    fetched_at,
    player_count,
    payload_hash,
    payload,
    is_current
  ) values (
    v_run_id,
    v_next_version,
    2,
    p_fetched_at,
    p_player_count,
    p_payload_hash,
    p_payload,
    true
  );

  update public.fpl_sync_runs
  set status = 'published', completed_at = now()
  where id = v_run_id;

  return jsonb_build_object(
    'published', true,
    'snapshot_version', v_next_version
  );
end;
$$;

revoke execute on function public.publish_fpl_snapshot(jsonb, text, timestamptz, integer, jsonb)
  from public, anon, authenticated;
grant execute on function public.publish_fpl_snapshot(jsonb, text, timestamptz, integer, jsonb)
  to service_role;

comment on function public.publish_fpl_snapshot(jsonb, text, timestamptz, integer, jsonb) is
  'Server-only atomic FPL publication endpoint for GitHub Actions. Browser roles cannot execute it.';

commit;
