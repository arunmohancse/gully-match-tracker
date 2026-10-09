-- Phase 3 database tests. Paste into the Supabase SQL Editor and Run.
-- Everything happens inside a transaction that is ROLLED BACK at the end, so no data is kept.
-- Success: the final result shows "ALL PHASE 3 TESTS PASSED". Any failure raises an error naming the check.

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

do $$
declare
  u    uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  names text[] := array['Arun','Rahul','Vishnu','Ajay','Manoj','Late Joiner','Admin'];
  v_match uuid;
  i int;
  res record;
  v_err text;
begin
  -- Fixtures (as table owner) ---------------------------------------------------
  for i in 1..7 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase3test' || i || '@example.com',
            jsonb_build_object('full_name', names[i], 'phone', '+9100000000' || i));
  end loop;
  update public.profiles set role = 'ADMIN' where id = u[7];
  update public.profiles set status = 'ACTIVE';   -- new signups start PENDING (migration 0011)

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase3 Test Match', current_date + 7, '06:00', 'Test Turf', 3, 150, 'OPEN')
  returning id into v_match;

  -- Registration order and list assignment ---------------------------------------
  perform pg_temp.as_user(u[1]);
  select * into res from public.register_for_match(v_match);
  perform pg_temp.check_eq('first player list', res.list_type, 'MAIN_LIST');
  perform pg_temp.check_eq('first player position', res.list_position::text, '1');
  perform pg_temp.check_eq('first player payment', res.payment_status, 'UNPAID');
  perform pg_temp.check_eq('first registration not duplicate', res.already_registered::text, 'false');

  -- Duplicate registration is idempotent and creates no second row
  select * into res from public.register_for_match(v_match);
  perform pg_temp.check_eq('duplicate flagged', res.already_registered::text, 'true');
  perform pg_temp.check_eq('duplicate position unchanged', res.list_position::text, '1');

  perform pg_temp.as_user(u[2]);
  select * into res from public.register_for_match(v_match);
  perform pg_temp.check_eq('second player position', res.list_position::text, '2');

  perform pg_temp.as_user(u[3]);
  select * into res from public.register_for_match(v_match);   -- last available slot
  perform pg_temp.check_eq('last slot list', res.list_type, 'MAIN_LIST');
  perform pg_temp.check_eq('last slot position', res.list_position::text, '3');

  perform pg_temp.as_owner();
  perform pg_temp.check_eq('match becomes FULL', (select status from public.matches where id = v_match), 'FULL');

  perform pg_temp.as_user(u[4]);
  select * into res from public.register_for_match(v_match);   -- first over capacity
  perform pg_temp.check_eq('overflow list', res.list_type, 'WAITING_LIST');
  perform pg_temp.check_eq('overflow position', res.list_position::text, '1');

  perform pg_temp.as_user(u[5]);
  select * into res from public.register_for_match(v_match);
  perform pg_temp.check_eq('second waiting position', res.list_position::text, '2');

  -- Roster: names and lists only ----------------------------------------------------
  perform pg_temp.as_user(u[1]);
  perform pg_temp.check_eq('roster size', (select count(*) from public.get_match_roster(v_match))::text, '5');
  perform pg_temp.check_eq('roster highlights me', (select count(*) from public.get_match_roster(v_match) where is_me)::text, '1');
  perform pg_temp.check_eq('roster order', (select string_agg(display_name, ',' order by list_type, list_position)
                                              from public.get_match_roster(v_match)), 'Arun,Rahul,Vishnu,Ajay,Manoj');

  -- Counts are public-safe
  select * into res from public.get_match_counts(array[v_match]);
  perform pg_temp.check_eq('main count', res.main_count::text, '3');
  perform pg_temp.check_eq('waiting count', res.waiting_count::text, '2');

  -- Authorization ------------------------------------------------------------------------
  perform pg_temp.check_eq('user sees only own registration', (select count(*) from public.registrations)::text, '1');
  perform pg_temp.check_eq('user cannot see others profiles', (select count(*) from public.profiles)::text, '1');

  begin
    insert into public.registrations (match_id, user_id, list_type, seq) values (v_match, u[1], 'MAIN_LIST', 99);
    raise exception 'FAIL [direct insert]: should have been denied';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.registrations set payment_status = 'PAID';
    raise exception 'FAIL [direct payment update]: should have been denied';
  exception when insufficient_privilege then null;
  end;

  begin
    update public.profiles set role = 'ADMIN' where id = u[1];
    raise exception 'FAIL [role escalation]: should have been denied';
  exception when insufficient_privilege then null;
  end;

  begin
    insert into public.matches (title, match_date, start_time, venue, max_players) values ('x', current_date, '06:00', 'v', 1);
    raise exception 'FAIL [user create match]: should have been denied';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;

  -- Admin sees everything
  perform pg_temp.as_user(u[7]);
  perform pg_temp.check_eq('admin sees all registrations', (select count(*) from public.registrations where match_id = v_match)::text, '5');

  -- Registration rules --------------------------------------------------------------------
  perform pg_temp.as_owner();
  update public.matches set status = 'CLOSED' where id = v_match;
  perform pg_temp.as_user(u[6]);
  begin
    perform * from public.register_for_match(v_match);
    raise exception 'FAIL [closed registration]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('closed error code', sqlerrm, 'REGISTRATION_CLOSED');
  end;

  -- Already registered players can still re-fetch their registration when closed (idempotent)
  perform pg_temp.as_user(u[1]);
  select * into res from public.register_for_match(v_match);
  perform pg_temp.check_eq('idempotent when closed', res.already_registered::text, 'true');

  perform pg_temp.as_owner();
  update public.matches set status = 'OPEN', registration_opens_at = now() + interval '1 day',
         registration_closes_at = now() + interval '2 days' where id = v_match;
  perform pg_temp.as_user(u[6]);
  begin
    perform * from public.register_for_match(v_match);
    raise exception 'FAIL [not yet open]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('not-open error code', sqlerrm, 'REGISTRATION_NOT_OPEN');
  end;

  perform pg_temp.as_owner();
  update public.matches set registration_opens_at = null, registration_closes_at = null,
         match_date = current_date - 1 where id = v_match;
  perform pg_temp.as_user(u[6]);
  begin
    perform * from public.register_for_match(v_match);
    raise exception 'FAIL [match started]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('started error code', sqlerrm, 'REGISTRATION_CLOSED');
  end;

  perform pg_temp.as_owner();
  update public.matches set status = 'DRAFT', match_date = current_date + 7 where id = v_match;
  perform pg_temp.as_user(u[6]);
  begin
    perform * from public.register_for_match(v_match);
    raise exception 'FAIL [draft]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('draft error code', sqlerrm, 'MATCH_NOT_FOUND');
  end;

  perform pg_temp.as_owner();
  perform pg_temp.check_eq('audit rows written', (select count(*) from public.audit_logs
            where action = 'REGISTRATION_CREATED' and (metadata->>'match_id')::uuid = v_match)::text, '5');
end $$;

select 'ALL PHASE 3 TESTS PASSED' as result;

rollback;
