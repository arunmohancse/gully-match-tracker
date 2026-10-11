-- Phase 19 database tests (phone required for approval, phone cannot be cleared). Requires migrations 0001-0020.
-- (Since 0020 players cannot write phone directly, so phone edits below are made as the table owner; the trigger still applies to everyone.)
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 19 TESTS PASSED".

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

-- Runs a statement as the given caller and returns 'ok' or the error text
create or replace function pg_temp.try(p_caller uuid, p_sql text) returns text language plpgsql as $$
begin
  perform pg_temp.as_user(p_caller);
  begin
    execute p_sql;
    perform pg_temp.as_owner();
    return 'ok';
  exception when others then
    perform pg_temp.as_owner();
    return sqlerrm;
  end;
end $$;

-- Runs a statement as the table owner and returns 'ok' or the error text
create or replace function pg_temp.try_owner(p_sql text) returns text language plpgsql as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlerrm;
end $$;

create or replace function pg_temp.status_of(p_uid uuid) returns text language sql as $$
  select status from public.profiles where id = p_uid;
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 3));
  i int;
begin
  -- u1 = admin; u2 signs up with a phone; u3 signs up without one (like a first Google sign-in)
  for i in 1..3 loop
    insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase19test' || i || '@example.com', 'x',
            case when i = 3 then jsonb_build_object('full_name', 'Player 3')
                 else jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000190' || i) end);
  end loop;
  update public.profiles set role = 'ADMIN', status = 'ACTIVE' where id = u[1];

  perform pg_temp.check_eq('signup without phone has no phone', (select (phone is null)::text from public.profiles where id = u[3]), 'true');

  -- Approval needs a phone -----------------------------------------------------------------------------------
  perform pg_temp.check_eq('cannot approve without phone', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[3])), 'PHONE_REQUIRED');
  perform pg_temp.check_eq('still pending', pg_temp.status_of(u[3]), 'PENDING');
  perform pg_temp.check_eq('can reject without phone', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''BLOCKED'')', u[3])), 'ok');
  perform pg_temp.check_eq('rejected', pg_temp.status_of(u[3]), 'BLOCKED');
  perform pg_temp.check_eq('can unblock without phone (existing account)', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[3])), 'ok');
  update public.profiles set status = 'PENDING' where id = u[3];

  perform pg_temp.check_eq('phone added', pg_temp.try_owner(format('update public.profiles set phone = ''+91000001903'' where id = %L', u[3])), 'ok');
  perform pg_temp.check_eq('can approve with phone', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[3])), 'ok');
  perform pg_temp.check_eq('approved', pg_temp.status_of(u[3]), 'ACTIVE');
  perform pg_temp.check_eq('approve with phone from signup', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[2])), 'ok');

  -- A saved phone can be changed, not cleared -------------------------------------------------------------------
  perform pg_temp.check_eq('phone changed by owner', pg_temp.try_owner(format('update public.profiles set phone = ''+91000001999'' where id = %L', u[2])), 'ok');
  perform pg_temp.check_eq('phone changed', (select phone from public.profiles where id = u[2]), '+91000001999');
  perform pg_temp.check_eq('phone cannot be cleared', pg_temp.try_owner(format('update public.profiles set phone = null where id = %L', u[2])), 'PHONE_REQUIRED');
  perform pg_temp.check_eq('phone kept', (select phone from public.profiles where id = u[2]), '+91000001999');
  perform pg_temp.check_eq('name change keeps phone', pg_temp.try(u[2], format('update public.profiles set full_name = ''Renamed'' where id = %L', u[2])), 'ok');
end $$;

select 'ALL PHASE 19 TESTS PASSED' as result;

rollback;
