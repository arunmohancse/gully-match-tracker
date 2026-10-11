-- Phone numbers: set once by the player, changed afterwards only with an admin's approval (or directly by an admin).
--   * set_initial_phone      player, only while their phone is empty
--   * request_phone_change   player asks for a new number; the current one stays until an admin approves
--   * cancel_phone_change    player withdraws their open request
--   * admin_list_phone_change_requests / admin_decide_phone_change   admin approves or rejects (own requests included)
--   * admin_set_user_phone   admin corrects a number directly
-- Clients can no longer write profiles.phone at all. Safe to re-run.

create table if not exists public.phone_change_requests (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  old_phone  text,
  new_phone  text not null check (new_phone ~ '^\+?[0-9]{7,15}$'),
  status     text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz
);
-- At most one open request per player.
create unique index if not exists phone_change_requests_one_pending on public.phone_change_requests (user_id) where status = 'PENDING';
create index if not exists phone_change_requests_user_idx on public.phone_change_requests (user_id, created_at desc);
create index if not exists phone_change_requests_decided_by_idx on public.phone_change_requests (decided_by);

alter table public.phone_change_requests enable row level security;
drop policy if exists phone_change_requests_select_own on public.phone_change_requests;
create policy phone_change_requests_select_own on public.phone_change_requests for select using (user_id = (select auth.uid()));
revoke all on public.phone_change_requests from anon, authenticated;
grant select on public.phone_change_requests to authenticated;

-- Phone is no longer writable by clients; only the functions below change it. ---------------------------------------
revoke update (phone) on public.profiles from authenticated;

-- Player: first phone ---------------------------------------------------------------------------------------------
create or replace function public.set_initial_phone(p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  update public.profiles set phone = p_phone where id = v_uid and phone is null;
  if not found then
    raise exception 'PHONE_ALREADY_SET' using errcode = 'P0001';
  end if;
end $$;

-- Player: ask for a change ----------------------------------------------------------------------------------------
create or replace function public.request_phone_change(p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid     uuid := auth.uid();
  v_current text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  select phone into v_current from public.profiles where id = v_uid and status <> 'BLOCKED';
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_current is null then
    raise exception 'PHONE_NOT_SET' using errcode = 'P0001';
  end if;
  if v_current = p_phone then
    raise exception 'PHONE_UNCHANGED' using errcode = 'P0001';
  end if;

  update public.phone_change_requests set status = 'CANCELLED', decided_at = now() where user_id = v_uid and status = 'PENDING';
  insert into public.phone_change_requests (user_id, old_phone, new_phone) values (v_uid, v_current, p_phone);
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'PHONE_CHANGE_REQUESTED', 'profile', v_uid, jsonb_build_object('user_id', v_uid, 'from', v_current, 'to', p_phone));
end $$;

-- Player: withdraw the open request ---------------------------------------------------------------------------------
create or replace function public.cancel_phone_change()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  update public.phone_change_requests set status = 'CANCELLED', decided_at = now() where user_id = v_uid and status = 'PENDING';
end $$;

-- Admin: open requests, oldest first ----------------------------------------------------------------------------------
create or replace function public.admin_list_phone_change_requests()
returns table (
  id            uuid,
  user_id       uuid,
  full_name     text,
  current_phone text,
  new_phone     text,
  created_at    timestamptz)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return query
  select r.id, r.user_id, p.full_name, p.phone, r.new_phone, r.created_at
    from public.phone_change_requests r join public.profiles p on p.id = r.user_id
   where r.status = 'PENDING'
   order by r.created_at, r.id;
end $$;

-- Admin: approve or reject (an admin may decide their own request) ------------------------------------------------------
create or replace function public.admin_decide_phone_change(p_request_id uuid, p_approve boolean)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  r     public.phone_change_requests;
  v_old text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  select * into r from public.phone_change_requests where id = p_request_id and status = 'PENDING' for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0001';
  end if;

  if p_approve then
    select phone into v_old from public.profiles where id = r.user_id for update;
    update public.profiles set phone = r.new_phone where id = r.user_id;
  end if;
  update public.phone_change_requests
     set status = case when p_approve then 'APPROVED' else 'REJECTED' end, decided_by = v_uid, decided_at = now()
   where id = r.id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when p_approve then 'PHONE_CHANGE_APPROVED' else 'PHONE_CHANGE_REJECTED' end, 'profile', r.user_id,
          jsonb_build_object('user_id', r.user_id, 'from', coalesce(v_old, r.old_phone), 'to', r.new_phone));
end $$;

-- Admin: correct a number directly --------------------------------------------------------------------------------------
create or replace function public.admin_set_user_phone(p_user_id uuid, p_phone text)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_old text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_phone is null or p_phone !~ '^\+?[0-9]{7,15}$' then
    raise exception 'INVALID_PHONE' using errcode = 'P0001';
  end if;
  select phone into v_old from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_old = p_phone then
    raise exception 'PHONE_UNCHANGED' using errcode = 'P0001';
  end if;

  update public.profiles set phone = p_phone where id = p_user_id;
  update public.phone_change_requests set status = 'CANCELLED', decided_by = v_uid, decided_at = now() where user_id = p_user_id and status = 'PENDING';
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'PHONE_CHANGED_BY_ADMIN', 'profile', p_user_id, jsonb_build_object('user_id', p_user_id, 'from', v_old, 'to', p_phone));
end $$;

revoke all on function public.set_initial_phone(text) from public, anon;
revoke all on function public.request_phone_change(text) from public, anon;
revoke all on function public.cancel_phone_change() from public, anon;
revoke all on function public.admin_list_phone_change_requests() from public, anon;
revoke all on function public.admin_decide_phone_change(uuid, boolean) from public, anon;
revoke all on function public.admin_set_user_phone(uuid, text) from public, anon;
grant execute on function public.set_initial_phone(text) to authenticated;
grant execute on function public.request_phone_change(text) to authenticated;
grant execute on function public.cancel_phone_change() to authenticated;
grant execute on function public.admin_list_phone_change_requests() to authenticated;
grant execute on function public.admin_decide_phone_change(uuid, boolean) to authenticated;
grant execute on function public.admin_set_user_phone(uuid, text) to authenticated;
