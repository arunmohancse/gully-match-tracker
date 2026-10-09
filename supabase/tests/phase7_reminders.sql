-- Phase 7 database tests (reminder log). Requires migrations 0001-0007.
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 7 TESTS PASSED".

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
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 3));
  i int;
  v_match uuid;
  v_rid uuid;
  v_cancelled_rid uuid;
begin
  for i in 1..3 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase7test' || i || '@example.com',
            jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000300' || i));
  end loop;
  update public.profiles set role = 'ADMIN' where id = u[3];
  update public.profiles set status = 'ACTIVE';   -- new signups start PENDING (migration 0011)

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase7 Test Match', current_date + 7, '06:00', 'Test Turf', 5, 150, 'OPEN') returning id into v_match;

  perform pg_temp.as_user(u[1]);
  perform * from public.register_for_match(v_match);
  perform pg_temp.as_user(u[2]);
  perform * from public.register_for_match(v_match);
  perform * from public.cancel_registration((select id from public.registrations where match_id = v_match and user_id = u[2]));
  perform pg_temp.as_owner();
  select id into v_rid from public.registrations where match_id = v_match and user_id = u[1];
  select id into v_cancelled_rid from public.registrations where match_id = v_match and user_id = u[2];

  -- Admin can log a reminder
  perform pg_temp.as_user(u[3]);
  perform public.log_reminder_opened(v_rid);
  perform public.log_reminder_opened(v_rid);   -- opening twice logs twice (it records each time)
  perform pg_temp.check_eq('admin sees the log', (select count(*)::text from public.audit_logs
            where action = 'REMINDER_OPENED' and entity_id = v_rid), '2');
  perform pg_temp.check_eq('log has match + channel', (select (metadata->>'match_id' = v_match::text and metadata->>'channel' = 'WHATSAPP_CLICK')::text
            from public.audit_logs where action = 'REMINDER_OPENED' and entity_id = v_rid limit 1), 'true');

  -- Rejections
  begin
    perform public.log_reminder_opened(v_cancelled_rid);
    raise exception 'FAIL [cancelled registration]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('cancelled error', sqlerrm, 'REGISTRATION_NOT_ACTIVE');
  end;
  begin
    perform public.log_reminder_opened(gen_random_uuid());
    raise exception 'FAIL [unknown registration]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('unknown error', sqlerrm, 'REGISTRATION_NOT_FOUND');
  end;

  -- A plain player cannot log reminders or read the audit log
  perform pg_temp.as_user(u[1]);
  begin
    perform public.log_reminder_opened(v_rid);
    raise exception 'FAIL [user logs reminder]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('user error', sqlerrm, 'NOT_ALLOWED');
  end;
  perform pg_temp.check_eq('user cannot read audit log', (select count(*)::text from public.audit_logs), '0');
  perform pg_temp.as_owner();
end $$;

select 'ALL PHASE 7 TESTS PASSED' as result;

rollback;
