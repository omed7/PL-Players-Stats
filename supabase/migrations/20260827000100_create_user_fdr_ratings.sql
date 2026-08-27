-- Phase 22: per-user custom fixture difficulty ratings.
-- Personal ratings are separate from official fixture data and are visible only
-- to their authenticated owner.

begin;

create table public.user_fdr_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  team_id integer not null check (team_id > 0),
  home_rating smallint check (home_rating is null or home_rating between 1 and 7),
  away_rating smallint check (away_rating is null or away_rating between 1 and 7),
  updated_at timestamptz not null default now(),
  primary key (user_id, team_id)
);

create index user_fdr_ratings_user_id_idx on public.user_fdr_ratings (user_id);

alter table public.user_fdr_ratings enable row level security;

revoke all on table public.user_fdr_ratings from anon, authenticated;
grant select, insert, update, delete on table public.user_fdr_ratings to authenticated;

create policy "user_fdr_ratings_select_own"
on public.user_fdr_ratings
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_fdr_ratings_insert_own"
on public.user_fdr_ratings
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_fdr_ratings_update_own"
on public.user_fdr_ratings
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_fdr_ratings_delete_own"
on public.user_fdr_ratings
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

commit;
