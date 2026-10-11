-- A phone number is how organisers reach a player, so:
--   * an admin cannot approve a PENDING signup that has no phone (PHONE_REQUIRED), and
--   * a player cannot clear a phone number they already saved.
-- Existing accounts without a phone are left alone: the app asks them for one at their next visit.

create or replace function public.admin_set_user_status(p_user_id uuid, p_status text)
returns table (user_id uuid, status text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  v_from  text;
  v_phone text;
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

  select status, phone into v_from, v_phone from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;
  if v_from = 'PENDING' and p_status = 'ACTIVE' and v_phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
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

-- Once a phone is saved it can be changed but not removed. ----------------------------------------------------------
create or replace function public.keep_phone()
returns trigger
language plpgsql set search_path = public as $$
begin
  if old.phone is not null and new.phone is null then
    raise exception 'PHONE_REQUIRED' using errcode = 'P0001';
  end if;
  return new;
end $$;

-- Trigger functions must not be callable through the API (see 0016 and the security review).
revoke execute on function public.keep_phone() from public, anon, authenticated;

drop trigger if exists profiles_keep_phone on public.profiles;
create trigger profiles_keep_phone before update of phone on public.profiles
  for each row execute function public.keep_phone();
