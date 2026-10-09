-- Phase 12 database tests (paged player list). Requires migrations 0001-0014 (0014 puts admins first).
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 12 TESTS PASSED".

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

-- Runs the list as the caller and returns "names|total" (names in returned order), or the error text
create or replace function pg_temp.list_as(p_caller uuid, p_query text, p_status text, p_limit int, p_offset int) returns text language plpgsql as $$
declare r text;
begin
  perform pg_temp.as_user(p_caller);
  begin
    select coalesce(string_agg(full_name, ',' order by ord), '') || '|' || coalesce(max(total_count), 0)
      into r from (select row_number() over () as ord, * from public.admin_list_players(p_query, p_status, p_limit, p_offset)) x;
    perform pg_temp.as_owner();
    return r;
  exception when others then
    perform pg_temp.as_owner();
    return sqlerrm;
  end;
end $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 5));
  names text[] := array['Zed Admin', 'Asha Test', 'Bala Test', 'Chitra 50% Test', 'Dev_Test'];
  i int;
begin
  for i in 1..5 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase12test' || i || '@example.com',
            jsonb_build_object('full_name', names[i], 'phone', '+9100000700' || i));
  end loop;
  update public.profiles set role = 'ADMIN', status = 'ACTIVE' where id = u[1];
  update public.profiles set status = 'ACTIVE' where id in (u[2], u[3]);
  update public.profiles set status = 'BLOCKED' where id = u[5];     -- u4 stays PENDING

  -- Only admins may list ------------------------------------------------------------------------------------
  perform pg_temp.check_eq('plain user refused', pg_temp.list_as(u[2], null, null, 50, 0), 'NOT_ALLOWED');
  perform pg_temp.check_eq('invalid status', pg_temp.list_as(u[1], null, 'NOPE', 50, 0), 'INVALID_STATUS');

  -- Search, filter, order, paging (the search words only match these test users) ----------------------------------
  perform pg_temp.check_eq('search by name, ordered', pg_temp.list_as(u[1], 'test', null, 50, 0), 'Asha Test,Bala Test,Chitra 50% Test,Dev_Test|4');
  perform pg_temp.check_eq('search by phone', pg_temp.list_as(u[1], '+9100000700', null, 50, 0), 'Zed Admin,Asha Test,Bala Test,Chitra 50% Test,Dev_Test|5'); -- admins first, then by name
  perform pg_temp.check_eq('admins stay first across pages', pg_temp.list_as(u[1], '+9100000700', null, 1, 0), 'Zed Admin|5');
  perform pg_temp.check_eq('wildcard % is literal', pg_temp.list_as(u[1], '50%', null, 50, 0), 'Chitra 50% Test|1');
  perform pg_temp.check_eq('wildcard _ is literal', pg_temp.list_as(u[1], 'dev_', null, 50, 0), 'Dev_Test|1');
  perform pg_temp.check_eq('status filter', pg_temp.list_as(u[1], 'test', 'PENDING', 50, 0), 'Chitra 50% Test|1');
  perform pg_temp.check_eq('blocked filter', pg_temp.list_as(u[1], 'test', 'BLOCKED', 50, 0), 'Dev_Test|1');
  perform pg_temp.check_eq('first page', pg_temp.list_as(u[1], 'test', null, 2, 0), 'Asha Test,Bala Test|4');
  perform pg_temp.check_eq('second page', pg_temp.list_as(u[1], 'test', null, 2, 2), 'Chitra 50% Test,Dev_Test|4');
  perform pg_temp.check_eq('past the end', pg_temp.list_as(u[1], 'test', null, 2, 10), '|0');

  -- Counts ----------------------------------------------------------------------------------------------------
  perform pg_temp.as_user(u[1]);
  perform pg_temp.check_eq('counts include test users', (select (total_count >= 5 and pending_count >= 1 and blocked_count >= 1)::text from public.admin_player_counts()), 'true');
  perform pg_temp.as_owner();
  begin
    perform pg_temp.as_user(u[2]);
    perform * from public.admin_player_counts();
    perform pg_temp.as_owner();
    raise exception 'FAIL [plain user read counts]';
  exception when others then
    perform pg_temp.as_owner();
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('counts refused for plain user', sqlerrm, 'NOT_ALLOWED');
  end;
end $$;

select 'ALL PHASE 12 TESTS PASSED' as result;

rollback;
