-- Phase 10 database tests (promoting / demoting admins). Requires migrations 0001-0010.
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 10 TESTS PASSED".

begin;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_owner() returns void language plpgsql as $$
begin
  execute 'reset role';
  perform set_config('request.jwt.claims', '', true);
end $$;

create or replace function pg_temp.check_eq(p_label text, p_actual text, p_expected text) returns void language plpgsql as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL [%]: expected %, got %', p_label, p_expected, p_actual;
  end if;
end $$;

create or replace function pg_temp.role_of(p_uid uuid) returns text language sql as $$
  select role from public.profiles where id = p_uid;
$$;

-- Runs set_user_role as the given caller and returns the resulting role, or the error code
create or replace function pg_temp.try_set(p_caller uuid, p_target uuid, p_role text) returns text language plpgsql as $$
declare r record;
begin
  perform pg_temp.as_user(p_caller);
  begin
    select * into r from public.set_user_role(p_target, p_role);
    perform pg_temp.as_owner();
    return r.role;
  exception when others then
    perform pg_temp.as_owner();
    return sqlerrm;
  end;
end $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 4));
  i int;
begin
  for i in 1..4 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase10test' || i || '@example.com',
            jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000500' || i));
  end loop;
  update public.profiles set role = 'ADMIN' where id = u[1];      -- u1 admin; u2, u3, u4 plain users
  update public.profiles set status = 'ACTIVE';   -- new signups start PENDING (migration 0011)

  -- An admin can promote a player ----------------------------------------------------------------------------
  perform pg_temp.check_eq('promote', pg_temp.try_set(u[1], u[2], 'ADMIN'), 'ADMIN');
  perform pg_temp.check_eq('role stored', pg_temp.role_of(u[2]), 'ADMIN');

  -- ...and the new admin really has admin powers (can promote someone else)
  perform pg_temp.check_eq('new admin can promote', pg_temp.try_set(u[2], u[3], 'ADMIN'), 'ADMIN');

  -- Repeating a change is harmless and not logged twice
  perform pg_temp.check_eq('promote again (idempotent)', pg_temp.try_set(u[1], u[2], 'ADMIN'), 'ADMIN');

  -- Demotion
  perform pg_temp.check_eq('demote', pg_temp.try_set(u[1], u[3], 'USER'), 'USER');
  perform pg_temp.check_eq('role stored after demotion', pg_temp.role_of(u[3]), 'USER');
  perform pg_temp.check_eq('demoted user loses admin powers', pg_temp.try_set(u[3], u[4], 'ADMIN'), 'NOT_ALLOWED');
  perform pg_temp.check_eq('target unchanged', pg_temp.role_of(u[4]), 'USER');

  -- Rules ----------------------------------------------------------------------------------------------------------
  perform pg_temp.check_eq('plain user cannot promote', pg_temp.try_set(u[4], u[4], 'ADMIN'), 'NOT_ALLOWED');
  perform pg_temp.check_eq('plain user cannot promote others', pg_temp.try_set(u[4], u[3], 'ADMIN'), 'NOT_ALLOWED');
  perform pg_temp.check_eq('cannot change own role', pg_temp.try_set(u[1], u[1], 'USER'), 'CANNOT_CHANGE_OWN_ROLE');
  perform pg_temp.check_eq('admin stays admin', pg_temp.role_of(u[1]), 'ADMIN');
  perform pg_temp.check_eq('invalid role', pg_temp.try_set(u[1], u[4], 'SUPERUSER'), 'INVALID_ROLE');
  perform pg_temp.check_eq('unknown user', pg_temp.try_set(u[1], gen_random_uuid(), 'ADMIN'), 'USER_NOT_FOUND');

  -- Direct updates are still impossible for any logged-in user, admin or not -------------------------------------
  perform pg_temp.as_user(u[1]);
  begin
    update public.profiles set role = 'ADMIN' where id = u[4];
    raise exception 'FAIL [direct role update by admin]: should have been denied';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('direct update had no effect', pg_temp.role_of(u[4]), 'USER');

  -- Audit ---------------------------------------------------------------------------------------------------------------
  -- Exactly three real changes were logged (the repeated promotion changed nothing, so it was not logged)
  perform pg_temp.check_eq('audit entries', (select string_agg((metadata->>'from') || '>' || (metadata->>'to'), ',' order by (metadata->>'from') || (metadata->>'to'))
            from public.audit_logs where action = 'ROLE_CHANGED' and created_at = now()), 'ADMIN>USER,USER>ADMIN,USER>ADMIN');
end $$;

select 'ALL PHASE 10 TESTS PASSED' as result;

rollback;
