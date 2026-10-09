-- Phase 11 database tests (signup approval, blocking, password resets). Requires migrations 0001-0011.
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 11 TESTS PASSED".

begin;

create or replace function pg_temp.as_user(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  execute 'set local role authenticated';
end $$;

create or replace function pg_temp.as_anon() returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', '', true);
  execute 'set local role anon';
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

-- Runs a statement as the given caller (null = logged out) and returns 'ok' or the error text
create or replace function pg_temp.try(p_caller uuid, p_sql text) returns text language plpgsql as $$
begin
  if p_caller is null then perform pg_temp.as_anon(); else perform pg_temp.as_user(p_caller); end if;
  begin
    execute p_sql;
    perform pg_temp.as_owner();
    return 'ok';
  exception when others then
    perform pg_temp.as_owner();
    return sqlerrm;
  end;
end $$;

create or replace function pg_temp.status_of(p_uid uuid) returns text language sql as $$
  select status from public.profiles where id = p_uid;
$$;

create or replace function pg_temp.pw_hash(p_uid uuid) returns text language sql as $$
  select encrypted_password from auth.users where id = p_uid;
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 4));
  v_match uuid;
  v_hash  text;
  i int;
begin
  for i in 1..4 loop
    insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase11test' || i || '@example.com', 'old-hash-' || i,
            jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000600' || i));
  end loop;
  -- u1 = admin (activated by hand, as for the first admin); u2, u3, u4 are fresh signups
  update public.profiles set role = 'ADMIN', status = 'ACTIVE' where id = u[1];

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase11 Test Match', current_date + 7, '06:00', 'Test Turf', 10, 150, 'OPEN')
  returning id into v_match;

  -- New signups start pending, and pending users cannot register ------------------------------------------------
  perform pg_temp.check_eq('new signup is pending', pg_temp.status_of(u[2]), 'PENDING');
  perform pg_temp.check_eq('pending cannot register', pg_temp.try(u[2], format('select * from public.register_for_match(%L)', v_match)), 'ACCOUNT_NOT_ACTIVE');

  -- Approval ------------------------------------------------------------------------------------------------
  perform pg_temp.check_eq('plain user cannot approve', pg_temp.try(u[3], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[2])), 'NOT_ALLOWED');
  perform pg_temp.check_eq('admin approves', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[2])), 'ok');
  perform pg_temp.check_eq('status stored', pg_temp.status_of(u[2]), 'ACTIVE');
  perform pg_temp.check_eq('active can register', pg_temp.try(u[2], format('select * from public.register_for_match(%L)', v_match)), 'ok');

  -- Blocking ------------------------------------------------------------------------------------------------
  perform pg_temp.check_eq('cannot block self', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''BLOCKED'')', u[1])), 'CANNOT_CHANGE_OWN_STATUS');
  perform pg_temp.check_eq('invalid status', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''PENDING'')', u[2])), 'INVALID_STATUS');
  perform pg_temp.check_eq('block', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''BLOCKED'')', u[2])), 'ok');
  perform pg_temp.check_eq('blocked is banned in auth', (select (banned_until > now())::text from auth.users where id = u[2]), 'true');
  perform pg_temp.check_eq('blocked cannot cancel', pg_temp.try(u[2], format('select * from public.cancel_registration((select id from public.registrations where user_id = %L))', u[2])), 'ACCOUNT_NOT_ACTIVE');
  perform pg_temp.check_eq('unblock', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[2])), 'ok');
  perform pg_temp.check_eq('unblocked is not banned', (select (banned_until is null)::text from auth.users where id = u[2]), 'true');

  -- A blocked admin loses admin powers -------------------------------------------------------------------------
  update public.profiles set role = 'ADMIN', status = 'ACTIVE' where id = u[3];
  perform pg_temp.check_eq('second admin blocks first', pg_temp.try(u[3], format('select * from public.admin_set_user_status(%L, ''BLOCKED'')', u[1])), 'ok');
  perform pg_temp.check_eq('blocked admin has no powers', pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[1])), 'NOT_ALLOWED');
  perform pg_temp.check_eq('restore first admin', pg_temp.try(u[3], format('select * from public.admin_set_user_status(%L, ''ACTIVE'')', u[1])), 'ok');

  -- Clients cannot write status or the reset switch directly ----------------------------------------------------
  perform pg_temp.as_user(u[4]);
  begin
    update public.profiles set status = 'ACTIVE' where id = u[4];
    raise exception 'FAIL [user changed own status]';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.profiles set password_reset_until = now() + interval '1 day' where id = u[4];
    raise exception 'FAIL [user enabled own password reset]';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('status unchanged', pg_temp.status_of(u[4]), 'PENDING');

  -- Temporary password by admin -----------------------------------------------------------------------------------
  v_hash := pg_temp.pw_hash(u[4]);
  perform pg_temp.check_eq('plain user cannot set password', pg_temp.try(u[2], format('select public.admin_set_temp_password(%L, ''longenough1'')', u[4])), 'NOT_ALLOWED');
  perform pg_temp.check_eq('weak password refused', pg_temp.try(u[1], format('select public.admin_set_temp_password(%L, ''short'')', u[4])), 'WEAK_PASSWORD');
  perform pg_temp.check_eq('cannot set own via admin tool', pg_temp.try(u[1], format('select public.admin_set_temp_password(%L, ''longenough1'')', u[1])), 'CANNOT_CHANGE_OWN_STATUS');
  perform pg_temp.check_eq('admin sets temp password', pg_temp.try(u[1], format('select public.admin_set_temp_password(%L, ''longenough1'')', u[4])), 'ok');
  perform pg_temp.check_eq('hash changed', (pg_temp.pw_hash(u[4]) is distinct from v_hash)::text, 'true');
  perform pg_temp.check_eq('hash verifies', (select (encrypted_password = extensions.crypt('longenough1', encrypted_password))::text from auth.users where id = u[4]), 'true');

  perform pg_temp.check_eq('temp password opens the change window', (select (password_reset_until > now())::text from public.profiles where id = u[4]), 'true');
  update public.profiles set password_reset_until = null where id = u[4];

  -- Self-service reset (logged out) ---------------------------------------------------------------------------------
  perform pg_temp.check_eq('refused while switch is off', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test4@example.com'', ''+91000006004'', ''newpassword1'')'), 'RESET_NOT_AVAILABLE');
  perform pg_temp.check_eq('plain user cannot enable', pg_temp.try(u[2], format('select public.admin_set_password_reset(%L, true)', u[4])), 'NOT_ALLOWED');
  perform pg_temp.check_eq('admin enables', pg_temp.try(u[1], format('select public.admin_set_password_reset(%L, true)', u[4])), 'ok');
  perform pg_temp.check_eq('wrong phone refused', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test4@example.com'', ''+91000009999'', ''newpassword1'')'), 'RESET_NOT_AVAILABLE');
  perform pg_temp.check_eq('wrong email refused', pg_temp.try(null, 'select public.reset_password_with_phone(''nobody@example.com'', ''+91000006004'', ''newpassword1'')'), 'RESET_NOT_AVAILABLE');
  perform pg_temp.check_eq('weak password refused (reset)', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test4@example.com'', ''+91000006004'', ''short'')'), 'WEAK_PASSWORD');
  v_hash := pg_temp.pw_hash(u[4]);
  perform pg_temp.check_eq('reset works', pg_temp.try(null, 'select public.reset_password_with_phone(''PHASE11TEST4@example.com'', ''91000006004'', ''newpassword1'')'), 'ok');
  perform pg_temp.check_eq('reset changed hash', (pg_temp.pw_hash(u[4]) is distinct from v_hash)::text, 'true');
  perform pg_temp.check_eq('switch is single use', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test4@example.com'', ''+91000006004'', ''another-pass1'')'), 'RESET_NOT_AVAILABLE');

  -- Expired switch and disabled switch -------------------------------------------------------------------------------
  update public.profiles set password_reset_until = now() - interval '1 minute' where id = u[4];
  perform pg_temp.check_eq('expired switch refused', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test4@example.com'', ''+91000006004'', ''newpassword2'')'), 'RESET_NOT_AVAILABLE');
  perform pg_temp.try(u[1], format('select public.admin_set_password_reset(%L, true)', u[4]));
  perform pg_temp.try(u[1], format('select public.admin_set_password_reset(%L, false)', u[4]));
  perform pg_temp.check_eq('disabled switch refused', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test4@example.com'', ''+91000006004'', ''newpassword2'')'), 'RESET_NOT_AVAILABLE');

  -- Logged-in change while the switch is on ---------------------------------------------------------------------------
  perform pg_temp.check_eq('own change refused while off', pg_temp.try(u[4], 'select public.complete_own_password_reset(''newpassword3'')'), 'RESET_NOT_AVAILABLE');
  perform pg_temp.try(u[1], format('select public.admin_set_password_reset(%L, true)', u[4]));
  perform pg_temp.check_eq('own change works while on', pg_temp.try(u[4], 'select public.complete_own_password_reset(''newpassword3'')'), 'ok');
  perform pg_temp.check_eq('own change is single use', pg_temp.try(u[4], 'select public.complete_own_password_reset(''newpassword4'')'), 'RESET_NOT_AVAILABLE');

  -- Blocked users cannot use the reset ------------------------------------------------------------------------------------
  perform pg_temp.try(u[1], format('select public.admin_set_password_reset(%L, true)', u[2]));
  perform pg_temp.try(u[1], format('select * from public.admin_set_user_status(%L, ''BLOCKED'')', u[2]));
  perform pg_temp.check_eq('blocked cannot reset', pg_temp.try(null, 'select public.reset_password_with_phone(''phase11test2@example.com'', ''+91000006002'', ''newpassword1'')'), 'RESET_NOT_AVAILABLE');

  -- The password itself never reaches the audit log -------------------------------------------------------------------
  perform pg_temp.check_eq('no password in audit', (select count(*)::text from public.audit_logs where metadata::text ilike '%longenough%' or metadata::text ilike '%newpassword%'), '0');
  perform pg_temp.check_eq('audit entries exist', (select (count(*) >= 5)::text from public.audit_logs
            where action in ('USER_STATUS_CHANGED', 'PASSWORD_SET_BY_ADMIN', 'PASSWORD_RESET_ENABLED', 'PASSWORD_RESET_USED') and created_at = now()), 'true');
end $$;

select 'ALL PHASE 11 TESTS PASSED' as result;

rollback;
