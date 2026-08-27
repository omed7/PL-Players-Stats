-- Phase 22: the composite primary key (user_id, team_id) already indexes user_id.
-- Remove the redundant single-column index to avoid an unnecessary write cost.

begin;

drop index if exists public.user_fdr_ratings_user_id_idx;

commit;
