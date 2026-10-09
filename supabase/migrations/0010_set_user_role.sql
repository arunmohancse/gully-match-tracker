-- Phase 10: let an admin promote a player to admin (or remove admin rights). Safe to re-run.
--
-- Direct updates to profiles.role stay impossible for clients (no column grant, plus the
-- prevent_role_change trigger). This function is the only app path, and it:
--   * requires the caller to be an admin
--   * refuses to change the caller's own role (so you cannot lock yourself out)
--   * serializes role changes, so two admins removing each other at the same instant cannot leave zero admins
--   * writes an audit entry

create or replace function public.set_user_role(p_user_id uuid, p_role text)
returns table (user_id uuid, role text)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid  uuid := auth.uid();
  v_from text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- One role change at a time. The admin check below runs AFTER the lock, so it sees the latest committed roles.
  perform pg_advisory_xact_lock(hashtext('set_user_role'));

  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_role not in ('ADMIN', 'USER') then
    raise exception 'INVALID_ROLE' using errcode = 'P0001';
  end if;
  if p_user_id = v_uid then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'P0001';
  end if;

  select role into v_from from public.profiles where id = p_user_id for update;
  if not found then
    raise exception 'USER_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_from is distinct from p_role then
    update public.profiles set role = p_role where id = p_user_id;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'ROLE_CHANGED', 'profile', p_user_id,
            jsonb_build_object('user_id', p_user_id, 'from', v_from, 'to', p_role));
  end if;

  return query select p_user_id, p_role;
end $$;

revoke all on function public.set_user_role(uuid, text) from public, anon;
grant execute on function public.set_user_role(uuid, text) to authenticated;
