-- Phase 2: audit_logs, matches (+ RLS, triggers), match-images storage bucket.
-- Safe to re-run.

-- Audit log (append-only; written only by SECURITY DEFINER triggers/RPCs) -------
create table if not exists public.audit_logs (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid references public.profiles(id) on delete set null,
  action      text not null,
  entity_type text not null,
  entity_id   uuid,
  metadata    jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists audit_logs_entity_idx on public.audit_logs (entity_type, entity_id, created_at desc);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);

alter table public.audit_logs enable row level security;
drop policy if exists audit_logs_admin_select on public.audit_logs;
create policy audit_logs_admin_select on public.audit_logs for select using (public.is_admin());
revoke all on public.audit_logs from anon, authenticated;
grant select on public.audit_logs to authenticated;

-- Matches ----------------------------------------------------------------------
create table if not exists public.matches (
  id                     uuid primary key default gen_random_uuid(),
  community_id           uuid not null references public.communities(id),
  title                  text not null check (length(btrim(title)) > 0),
  description            text,
  match_date             date not null,
  start_time             time not null,
  end_time               time,
  venue                  text not null check (length(btrim(venue)) > 0),
  max_players            integer not null check (max_players > 0),
  registration_fee       numeric(10,2) not null default 0 check (registration_fee >= 0),
  registration_opens_at  timestamptz,
  registration_closes_at timestamptz,
  rules                  text,
  image_path             text,
  status                 text not null default 'DRAFT'
                           check (status in ('DRAFT','OPEN','FULL','CLOSED','COMPLETED','CANCELLED')),
  next_seq               bigint not null default 1,   -- per-match registration counter (used from Phase 3)
  created_by             uuid references public.profiles(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint matches_end_after_start check (end_time is null or end_time > start_time),
  constraint matches_close_after_open check (
    registration_opens_at is null or registration_closes_at is null
    or registration_closes_at > registration_opens_at)
);
create index if not exists matches_community_date_idx on public.matches (community_id, match_date, start_time);
create index if not exists matches_status_idx on public.matches (status);

drop trigger if exists matches_set_updated_at on public.matches;
create trigger matches_set_updated_at before update on public.matches
  for each row execute function public.set_updated_at();

-- Fill created_by from the session and default the community (single community in v1).
create or replace function public.matches_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  new.next_seq := 1;
  if new.community_id is null then
    select id into new.community_id from public.communities order by created_at limit 1;
  end if;
  return new;
end $$;

drop trigger if exists matches_before_insert on public.matches;
create trigger matches_before_insert before insert on public.matches
  for each row execute function public.matches_before_insert();

-- COMPLETED and CANCELLED are terminal.
create or replace function public.matches_guard_status()
returns trigger language plpgsql as $$
begin
  if old.status in ('COMPLETED','CANCELLED') and new.status is distinct from old.status then
    raise exception 'INVALID_STATUS_CHANGE' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists matches_guard_status on public.matches;
create trigger matches_guard_status before update on public.matches
  for each row execute function public.matches_guard_status();

-- Audit: MATCH_CREATED / MATCH_UPDATED / MATCH_CANCELLED.
-- Ignores bookkeeping-only changes (next_seq, updated_at, automatic OPEN<->FULL flips).
create or replace function public.audit_match_change()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  o jsonb;
  n jsonb;
  v_changes jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'MATCH_CREATED', 'match', new.id, jsonb_build_object('title', new.title));
    return new;
  end if;

  o := to_jsonb(old) - 'next_seq' - 'updated_at';
  n := to_jsonb(new) - 'next_seq' - 'updated_at';
  if old.status in ('OPEN','FULL') and new.status in ('OPEN','FULL') then
    o := o - 'status';
    n := n - 'status';
  end if;
  if o = n then
    return new;
  end if;

  select jsonb_object_agg(k.key, jsonb_build_object('from', o -> k.key, 'to', n -> k.key))
    into v_changes
    from jsonb_object_keys(n) as k(key)
   where (o -> k.key) is distinct from (n -> k.key);

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (
    auth.uid(),
    case when new.status = 'CANCELLED' and old.status <> 'CANCELLED' then 'MATCH_CANCELLED' else 'MATCH_UPDATED' end,
    'match', new.id, jsonb_build_object('changes', coalesce(v_changes, '{}'::jsonb))
  );
  return new;
end $$;

drop trigger if exists matches_audit on public.matches;
create trigger matches_audit after insert or update on public.matches
  for each row execute function public.audit_match_change();

-- RLS + grants -----------------------------------------------------------------
alter table public.matches enable row level security;

drop policy if exists matches_select on public.matches;
create policy matches_select on public.matches for select
  using (status <> 'DRAFT' or public.is_admin());

drop policy if exists matches_admin_insert on public.matches;
create policy matches_admin_insert on public.matches for insert with check (public.is_admin());

drop policy if exists matches_admin_update on public.matches;
create policy matches_admin_update on public.matches for update
  using (public.is_admin()) with check (public.is_admin());

-- No DELETE (cancel instead). Column-level grants keep id/next_seq/created_by server-controlled.
revoke all on public.matches from anon, authenticated;
grant select on public.matches to anon, authenticated;
grant insert (community_id, title, description, match_date, start_time, end_time, venue, max_players,
              registration_fee, registration_opens_at, registration_closes_at, rules, image_path, status)
  on public.matches to authenticated;
grant update (title, description, match_date, start_time, end_time, venue, max_players,
              registration_fee, registration_opens_at, registration_closes_at, rules, image_path, status)
  on public.matches to authenticated;

-- Storage: public announcement images, admin-only writes -------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('match-images', 'match-images', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists match_images_admin_select on storage.objects;
create policy match_images_admin_select on storage.objects for select
  using (bucket_id = 'match-images' and public.is_admin());
drop policy if exists match_images_admin_insert on storage.objects;
create policy match_images_admin_insert on storage.objects for insert
  with check (bucket_id = 'match-images' and public.is_admin());
drop policy if exists match_images_admin_update on storage.objects;
create policy match_images_admin_update on storage.objects for update
  using (bucket_id = 'match-images' and public.is_admin());
drop policy if exists match_images_admin_delete on storage.objects;
create policy match_images_admin_delete on storage.objects for delete
  using (bucket_id = 'match-images' and public.is_admin());
