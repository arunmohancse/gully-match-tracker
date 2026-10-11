-- Phase 20 database tests (phone change requests). Requires migrations 0001-0020.
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 20 TESTS PASSED".

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

create or replace function pg_temp.phone_of(p_uid uuid) returns text language sql as $$
  select phone from public.profiles where id = p_uid;
$$;

create or replace function pg_temp.req_id(p_uid uuid, p_status text) returns uuid language sql as $$
  select id from public.phone_change_requests where user_id = p_uid and status = p_status order by created_at desc limit 1;
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 4));
  i int;
  v_req uuid;
  v_count int;
begin
  -- u1, u2 = admins; u3 has a phone; u4 signed up without one
  for i in 1..4 loop
    insert into auth.users (id, aud, role, email, encrypted_password, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase20test' || i || '@example.com', 'x',
            case when i = 4 then jsonb_build_object('full_name', 'Player 4')
                 else jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000200' || i) end);
  end loop;
  update public.profiles set role = 'ADMIN', status = 'ACTIVE' where id in (u[1], u[2]);
  update public.profiles set status = 'ACTIVE' where id in (u[3], u[4]);

  -- Clients cannot write the phone directly ------------------------------------------------------------------------
  perform pg_temp.check_eq('direct phone update refused', (pg_temp.try(u[3], format('update public.profiles set phone = ''+91999999999'' where id = %L', u[3])) like 'permission denied%')::text, 'true');
  perform pg_temp.check_eq('phone untouched', pg_temp.phone_of(u[3]), '+91000002003');
  perform pg_temp.check_eq('name update still allowed', pg_temp.try(u[3], format('update public.profiles set full_name = ''Renamed'' where id = %L', u[3])), 'ok');
  perform pg_temp.check_eq('requests cannot be inserted directly', (pg_temp.try(u[3], format('insert into public.phone_change_requests (user_id, new_phone) values (%L, ''+91999999999'')', u[3])) like 'permission denied%')::text, 'true');

  -- First phone ---------------------------------------------------------------------------------------------------
  perform pg_temp.check_eq('invalid initial phone', pg_temp.try(u[4], 'select public.set_initial_phone(''abc'')'), 'INVALID_PHONE');
  perform pg_temp.check_eq('request needs a phone first', pg_temp.try(u[4], 'select public.request_phone_change(''+91000002999'')'), 'PHONE_NOT_SET');
  perform pg_temp.check_eq('sets initial phone', pg_temp.try(u[4], 'select public.set_initial_phone(''+91000002004'')'), 'ok');
  perform pg_temp.check_eq('initial phone stored', pg_temp.phone_of(u[4]), '+91000002004');
  perform pg_temp.check_eq('initial phone only once', pg_temp.try(u[4], 'select public.set_initial_phone(''+91000002888'')'), 'PHONE_ALREADY_SET');

  -- Requesting a change -----------------------------------------------------------------------------------------------
  perform pg_temp.check_eq('invalid new phone', pg_temp.try(u[3], 'select public.request_phone_change(''12'')'), 'INVALID_PHONE');
  perform pg_temp.check_eq('same phone refused', pg_temp.try(u[3], 'select public.request_phone_change(''+91000002003'')'), 'PHONE_UNCHANGED');
  perform pg_temp.check_eq('request created', pg_temp.try(u[3], 'select public.request_phone_change(''+91000002101'')'), 'ok');
  perform pg_temp.check_eq('phone not changed by a request', pg_temp.phone_of(u[3]), '+91000002003');
  perform pg_temp.check_eq('new request replaces the old one', pg_temp.try(u[3], 'select public.request_phone_change(''+91000002102'')'), 'ok');
  perform pg_temp.check_eq('only one pending', (select count(*)::text from public.phone_change_requests where user_id = u[3] and status = 'PENDING'), '1');
  perform pg_temp.check_eq('older one cancelled', (select count(*)::text from public.phone_change_requests where user_id = u[3] and status = 'CANCELLED'), '1');
  perform pg_temp.check_eq('player sees own request', (select count(*)::text from public.phone_change_requests where user_id = u[3]), '2');

  -- Privacy: another player cannot see it; only admins can list requests ---------------------------------------------------
  perform pg_temp.as_user(u[4]);
  select count(*) into v_count from public.phone_change_requests;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('other players see no requests', v_count::text, '0');
  perform pg_temp.check_eq('plain user cannot list requests', pg_temp.try(u[4], 'select * from public.admin_list_phone_change_requests()'), 'NOT_ALLOWED');
  perform pg_temp.check_eq('admin lists requests', pg_temp.try(u[1], 'select * from public.admin_list_phone_change_requests()'), 'ok');

  -- Deciding ---------------------------------------------------------------------------------------------------------------
  v_req := pg_temp.req_id(u[3], 'PENDING');
  perform pg_temp.check_eq('plain user cannot approve', pg_temp.try(u[4], format('select public.admin_decide_phone_change(%L, true)', v_req)), 'NOT_ALLOWED');
  perform pg_temp.check_eq('unknown request', pg_temp.try(u[1], format('select public.admin_decide_phone_change(%L, true)', gen_random_uuid())), 'REQUEST_NOT_FOUND');
  perform pg_temp.check_eq('admin rejects', pg_temp.try(u[1], format('select public.admin_decide_phone_change(%L, false)', v_req)), 'ok');
  perform pg_temp.check_eq('rejected keeps old phone', pg_temp.phone_of(u[3]), '+91000002003');
  perform pg_temp.check_eq('rejected request is closed', pg_temp.try(u[1], format('select public.admin_decide_phone_change(%L, true)', v_req)), 'REQUEST_NOT_FOUND');

  perform pg_temp.check_eq('new request after rejection', pg_temp.try(u[3], 'select public.request_phone_change(''+91000002103'')'), 'ok');
  v_req := pg_temp.req_id(u[3], 'PENDING');
  perform pg_temp.check_eq('admin approves', pg_temp.try(u[2], format('select public.admin_decide_phone_change(%L, true)', v_req)), 'ok');
  perform pg_temp.check_eq('approved phone applied', pg_temp.phone_of(u[3]), '+91000002103');
  perform pg_temp.check_eq('decision recorded', (select (decided_by = u[2] and status = 'APPROVED')::text from public.phone_change_requests where id = v_req), 'true');

  -- An admin can approve their own request ---------------------------------------------------------------------------------
  perform pg_temp.check_eq('admin requests own change', pg_temp.try(u[1], 'select public.request_phone_change(''+91000002201'')'), 'ok');
  perform pg_temp.check_eq('admin approves own request', pg_temp.try(u[1], format('select public.admin_decide_phone_change(%L, true)', pg_temp.req_id(u[1], 'PENDING'))), 'ok');
  perform pg_temp.check_eq('admin own phone updated', pg_temp.phone_of(u[1]), '+91000002201');

  -- Player withdraws -------------------------------------------------------------------------------------------------------
  perform pg_temp.try(u[4], 'select public.request_phone_change(''+91000002301'')');
  perform pg_temp.check_eq('player cancels', pg_temp.try(u[4], 'select public.cancel_phone_change()'), 'ok');
  perform pg_temp.check_eq('nothing pending after cancel', (select count(*)::text from public.phone_change_requests where user_id = u[4] and status = 'PENDING'), '0');

  -- Admin direct edit --------------------------------------------------------------------------------------------------------
  perform pg_temp.try(u[4], 'select public.request_phone_change(''+91000002302'')');
  perform pg_temp.check_eq('plain user cannot set others phone', pg_temp.try(u[3], format('select public.admin_set_user_phone(%L, ''+91000002401'')', u[4])), 'NOT_ALLOWED');
  perform pg_temp.check_eq('invalid phone refused (admin)', pg_temp.try(u[1], format('select public.admin_set_user_phone(%L, ''x'')', u[4])), 'INVALID_PHONE');
  perform pg_temp.check_eq('unknown user', pg_temp.try(u[1], format('select public.admin_set_user_phone(%L, ''+91000002401'')', gen_random_uuid())), 'USER_NOT_FOUND');
  perform pg_temp.check_eq('admin sets phone', pg_temp.try(u[1], format('select public.admin_set_user_phone(%L, ''+91000002401'')', u[4])), 'ok');
  perform pg_temp.check_eq('admin edit applied', pg_temp.phone_of(u[4]), '+91000002401');
  perform pg_temp.check_eq('admin edit closes the open request', (select count(*)::text from public.phone_change_requests where user_id = u[4] and status = 'PENDING'), '0');
  perform pg_temp.check_eq('same phone refused (admin)', pg_temp.try(u[1], format('select public.admin_set_user_phone(%L, ''+91000002401'')', u[4])), 'PHONE_UNCHANGED');

  -- Audit trail ------------------------------------------------------------------------------------------------------------------
  perform pg_temp.check_eq('audit entries exist', (select (count(distinct action) = 4)::text from public.audit_logs
            where action in ('PHONE_CHANGE_REQUESTED', 'PHONE_CHANGE_APPROVED', 'PHONE_CHANGE_REJECTED', 'PHONE_CHANGED_BY_ADMIN') and created_at = now()), 'true');
end $$;

select 'ALL PHASE 20 TESTS PASSED' as result;

rollback;
