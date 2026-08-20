-- Phase 8B: authenticated public FPL Team ID synchronisation.
-- Extends the existing owner-only preference row. Public picks and all FPL
-- profile/credential data remain outside Supabase storage.

begin;

alter table public.user_preferences
  add column fpl_team_id integer,
  add column fdr_sort_mode text;

alter table public.user_preferences
  add constraint user_preferences_fpl_team_id_positive
    check (fpl_team_id is null or fpl_team_id > 0),
  add constraint user_preferences_fdr_sort_mode_valid
    check (fdr_sort_mode is null or fdr_sort_mode in ('avg', 'alpha'));

commit;
