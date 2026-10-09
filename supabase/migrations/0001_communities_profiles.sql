-- Phase 1: communities, profiles, auth hook, role helpers, RLS.
-- Safe to re-run: uses IF NOT EXISTS / CREATE OR REPLACE / DROP POLICY IF EXISTS.

create extension if not exists pgcrypto;

-- Shared updated_at trigger ---------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- Communities (multi-club ready; v1 has a single row) -------------------------
create table if not exists public.communities (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  slug       text not null unique,
  timezone   text not null default 'Asia/Kolkata',
  created_at timestamptz not null default now()
);

-- Profiles --------------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  full_name  text not null check (length(btrim(full_name)) > 0),
  phone      text check (phone is null or phone ~ '^\+?[0-9]{7,15}$'),
  role       text not null default 'USER' check (role in ('ADMIN','USER')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Role helper. SECURITY DEFINER so policies on profiles can call it without recursion.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN');
$$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Auto-create profile on signup. Role is ALWAYS 'USER' here; client metadata is ignored for it.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '[^0-9+]', '', 'g'), '');
begin
  insert into public.profiles (id, full_name, phone, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    case when v_phone ~ '^\+?[0-9]{7,15}$' then v_phone else null end,
    'USER'
  );
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Second layer against role escalation (first layer: column grants below).
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change before update on public.profiles
  for each row execute function public.prevent_role_change();

-- RLS -------------------------------------------------------------------------
alter table public.communities enable row level security;
alter table public.profiles    enable row level security;

drop policy if exists communities_read on public.communities;
create policy communities_read on public.communities for select using (true);

drop policy if exists communities_admin_write on public.communities;
create policy communities_admin_write on public.communities for all
  using (public.is_admin()) with check (public.is_admin());

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles for select
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- No client INSERT/DELETE on profiles (insert happens in the signup trigger).
-- Column-level grants: users may update only name + phone, never role.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

revoke all on public.communities from anon, authenticated;
grant select on public.communities to anon, authenticated;
