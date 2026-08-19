-- Phase 3A: FPL Omed account foundation
-- This migration creates only user-owned preference data. Every exposed table is
-- protected by explicit grants and owner-only RLS policies in the same transaction.

begin;

create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  theme text not null default 'green' check (theme in ('green', 'orange', 'lightblue', 'yellow', 'softred')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.watchlist_items (
  user_id uuid not null references auth.users(id) on delete cascade,
  element_id integer not null check (element_id > 0),
  created_at timestamptz not null default now(),
  primary key (user_id, element_id)
);

create index watchlist_items_user_id_idx on public.watchlist_items (user_id);

alter table public.profiles enable row level security;
alter table public.user_preferences enable row level security;
alter table public.watchlist_items enable row level security;

revoke all on table public.profiles from anon, authenticated;
revoke all on table public.user_preferences from anon, authenticated;
revoke all on table public.watchlist_items from anon, authenticated;

grant select, insert, update, delete on table public.profiles to authenticated;
grant select, insert, update, delete on table public.user_preferences to authenticated;
grant select, insert, update, delete on table public.watchlist_items to authenticated;

create policy "profiles_select_own"
on public.profiles
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "profiles_delete_own"
on public.profiles
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_select_own"
on public.user_preferences
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_insert_own"
on public.user_preferences
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_update_own"
on public.user_preferences
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "user_preferences_delete_own"
on public.user_preferences
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "watchlist_items_select_own"
on public.watchlist_items
for select
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "watchlist_items_insert_own"
on public.watchlist_items
for insert
to authenticated
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "watchlist_items_update_own"
on public.watchlist_items
for update
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id)
with check ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create policy "watchlist_items_delete_own"
on public.watchlist_items
for delete
to authenticated
using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

commit;
