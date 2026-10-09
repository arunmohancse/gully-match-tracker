-- Phase 11: signup approval, blocking, and admin-controlled password resets. Safe to re-run.
--
-- profiles.status: PENDING (new signup, waiting for an admin), ACTIVE, BLOCKED.
--   * Existing users become ACTIVE. New signups start PENDING.
--   * Clients cannot write status (no column grant); only admin_set_user_status can.
--   * Pending/blocked users cannot register or cancel (trigger on registrations), and a blocked user is also
--     banned in auth so they cannot log in or refresh a session.
-- Passwords (no service_role key in the app, so these are locked SECURITY DEFINER functions):
--   * admin_set_temp_password: admin sets a temporary password for a player (and opens their change-password window).
--   * admin_set_password_reset: admin switches self-service reset on/off (open for 24 hours, single use).
--   * reset_password_with_phone: logged-out user proves email + registered phone, sets a new password. Needs the switch.
--   * complete_own_password_reset: logged-in user sets a new password while the switch is on.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists status text not null default 'ACTIVE';
alter table public.profiles drop constraint if exists profiles_status_check;
alter table public.profiles add constraint profiles_status_check check (status in ('PENDING', 'ACTIVE', 'BLOCKED'));
alter table public.profiles alter column status set default 'PENDING';
alter table public.profiles add column if not exists password_reset_until timestamptz;

-- Clients read their own row (and admins read all); they still cannot write these columns.
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

-- New signups are PENDING. Role is still always USER.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_phone text := nullif(regexp_replace(coalesce(new.raw_user_meta_data->>'phone', ''), '[^0-9+]', '', 'g'), '');
begin
  insert into public.profiles (id, full_name, phone, role, status)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data->>'full_name'), ''), split_part(new.email, '@', 1)),
    case when v_phone ~ '^\+?[0-9]{7,15}$' then v_phone else null end,
    'USER',
    'PENDING'
  );
  return new;
end $$;

-- Admin powers require an active account.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'ADMIN' and status = 'ACTIVE');
$$;

-- Second layer: status and the reset switch can only be changed by an admin (or directly in the database).
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (new.role is distinct from old.role
      or new.status is distinct from old.status
      or new.password_reset_until is distinct from old.password_reset_until)
     and auth.uid() is not null
     and coalesce(current_setting('app.trusted_write', true), '') <> '1'
     and not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Pending and blocked accounts cannot register or cancel ---------------------------------------------------------
create or replace function public.require_active_account()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and not exists (select 1 from public.profiles where id = auth.uid() and status = 'ACTIVE') then
    raise exception 'ACCOUNT_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists registrations_require_active on public.registrations;
create trigger registrations_require_active before insert or update on public.registrations
  for each row execute function public.require_active_account();

-- Admin: approve / block / unblock ---------------------------------------------------------------------------------
create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns table (user_id uuid, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_from text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_status not in ('ACTIVE', 'BLOCKED') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if p_user_id = v_uid then
    raise exception 'CANNOT_CHANGE_OWN_STATUS' using errcode = 'P0001';
  end if;

  select status into v_from from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_from is distinct from p_status then
    update public.profiles set status = p_status where id = p_user_id;
    if p_status = 'BLOCKED' then
      update auth.users set banned_until = 'infinity' where id = p_user_id;
      delete from auth.sessions where user_id = p_user_id;
    else
      update auth.users set banned_until = null where id = p_user_id;
    end if;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'USER_STATUS_CHANGED', 'profile', p_user_id,
            jsonb_build_object('user_id', p_user_id, 'from', v_from, 'to', p_status));
  end if;

  return query select p_user_id, p_status;
end $$;

revoke all on function public.admin_set_user_status(uuid, text) from public, anon;
grant execute on function public.admin_set_user_status(uuid, text) to authenticated;

-- Admin: set a temporary password ----------------------------------------------------------------------------------
create or replace function public.admin_set_temp_password(p_user_id uuid, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_user_id = v_uid then
    raise exception 'CANNOT_CHANGE_OWN_STATUS' using errcode = 'P0001';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'WEAK_PASSWORD' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = p_user_id) then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = p_user_id;
  delete from auth.sessions where user_id = p_user_id;
  -- Opens the change-password window for 24 hours so they can swap the temporary password for their own.
  update public.profiles set password_reset_until = now() + interval '24 hours' where id = p_user_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'PASSWORD_SET_BY_ADMIN', 'profile', p_user_id, jsonb_build_object('user_id', p_user_id));
end $$;

revoke all on function public.admin_set_temp_password(uuid, text) from public, anon;
grant execute on function public.admin_set_temp_password(uuid, text) to authenticated;

-- Admin: switch self-service password reset on or off (on = open for 24 hours) -----------------------------------------
create or replace function public.admin_set_password_reset(p_user_id uuid, p_enabled boolean)
returns timestamptz
language plpgsql security definer set search_path = public as $$
declare
  v_uid   uuid := auth.uid();
  v_until timestamptz := case when p_enabled then now() + interval '24 hours' else null end;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_user_id = v_uid then
    raise exception 'CANNOT_CHANGE_OWN_STATUS' using errcode = 'P0001';
  end if;
  update public.profiles set password_reset_until = v_until where id = p_user_id;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, case when p_enabled then 'PASSWORD_RESET_ENABLED' else 'PASSWORD_RESET_DISABLED' end, 'profile', p_user_id,
          jsonb_build_object('user_id', p_user_id));
  return v_until;
end $$;

revoke all on function public.admin_set_password_reset(uuid, boolean) from public, anon;
grant execute on function public.admin_set_password_reset(uuid, boolean) to authenticated;

-- Logged-out user: email + registered phone + new password. Same generic error for every failure. -----------------------
create or replace function public.reset_password_with_phone(p_email text, p_phone text, p_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_id     uuid;
  v_digits text := right(regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g'), 10);
begin
  if p_password is null or length(p_password) < 8 then
    raise exception 'WEAK_PASSWORD' using errcode = 'P0001';
  end if;

  select p.id into v_id
    from auth.users u join public.profiles p on p.id = u.id
   where lower(u.email) = lower(btrim(coalesce(p_email, '')))
     and length(v_digits) >= 7
     and right(regexp_replace(coalesce(p.phone, ''), '[^0-9]', '', 'g'), 10) = v_digits
     and p.status <> 'BLOCKED'
     and p.password_reset_until > now()
   for update of p;
  if v_id is null then
    raise exception 'RESET_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = v_id;
  delete from auth.sessions where user_id = v_id;
  update public.profiles set password_reset_until = null where id = v_id;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (null, 'PASSWORD_RESET_USED', 'profile', v_id, jsonb_build_object('user_id', v_id));
end $$;

revoke all on function public.reset_password_with_phone(text, text, text) from public;
grant execute on function public.reset_password_with_phone(text, text, text) to anon, authenticated;

-- Logged-in user: change own password while the admin's switch is on ---------------------------------------------------
create or replace function public.complete_own_password_reset(p_password text)
returns void
language plpgsql security definer set search_path = public, extensions as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if p_password is null or length(p_password) < 8 then
    raise exception 'WEAK_PASSWORD' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles where id = v_uid and status <> 'BLOCKED' and password_reset_until > now()) then
    raise exception 'RESET_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')), updated_at = now() where id = v_uid;
  perform set_config('app.trusted_write', '1', true);   -- lets the guard trigger accept clearing the switch
  update public.profiles set password_reset_until = null where id = v_uid;
  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'PASSWORD_RESET_USED', 'profile', v_uid, jsonb_build_object('user_id', v_uid));
end $$;

revoke all on function public.complete_own_password_reset(text) from public, anon;
grant execute on function public.complete_own_password_reset(text) to authenticated;
