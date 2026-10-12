-- Phase 21 database tests (migration 0021): the UPCOMING match status. Paste into the Supabase SQL Editor and Run.
-- Everything happens inside a transaction that is ROLLED BACK at the end, so no data is kept.
-- Success: the final result shows "ALL PHASE 21 TESTS PASSED". Any failure raises an error naming the check.

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

-- The error text raised by registering for a match, or 'OK' when it worked.
create or replace function pg_temp.register_result(p_match uuid) returns text language plpgsql as $$
begin
  perform public.register_for_match(p_match);
  return 'OK';
exception when others then
  return sqlerrm;
end $$;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user  uuid := gen_random_uuid();
  v_match uuid;
  v_seen  integer;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values (v_admin, 'authenticated', 'authenticated', 'phase21admin@example.com', jsonb_build_object('full_name', 'Admin', 'phone', '+910000002101')),
         (v_user,  'authenticated', 'authenticated', 'phase21user@example.com',  jsonb_build_object('full_name', 'Player', 'phone', '+910000002102'));
  update public.profiles set status = 'ACTIVE';
  update public.profiles set role = 'ADMIN' where id = v_admin;

  insert into public.matches (title, match_date, start_time, venue, max_players, status)
  values ('Phase21 Match', current_date + 7, '06:00', 'Test Turf', 10, 'DRAFT') returning id into v_match;

  -- A draft is hidden from players and cannot be registered for ---------------------------------------------------
  perform pg_temp.as_user(v_user);
  select count(*) into v_seen from public.matches where id = v_match;
  if v_seen <> 0 then raise exception 'FAIL [players can see a draft]'; end if;
  if pg_temp.register_result(v_match) <> 'MATCH_NOT_FOUND' then raise exception 'FAIL [registering for a draft must say MATCH_NOT_FOUND]'; end if;

  -- An admin can publish it as UPCOMING ---------------------------------------------------------------------------
  perform pg_temp.as_user(v_admin);
  update public.matches set status = 'UPCOMING' where id = v_match;
  if (select status from public.matches where id = v_match) <> 'UPCOMING' then raise exception 'FAIL [admin could not set UPCOMING]'; end if;

  -- Players see it, but cannot register -----------------------------------------------------------------------------
  perform pg_temp.as_user(v_user);
  select count(*) into v_seen from public.matches where id = v_match;
  if v_seen <> 1 then raise exception 'FAIL [players must see an UPCOMING match]'; end if;
  if pg_temp.register_result(v_match) <> 'REGISTRATION_NOT_OPEN' then raise exception 'FAIL [registering for UPCOMING must say REGISTRATION_NOT_OPEN]'; end if;

  perform pg_temp.as_owner();
  if exists (select 1 from public.registrations where match_id = v_match) then raise exception 'FAIL [a registration was created for an UPCOMING match]'; end if;

  -- A player cannot publish or open a match -------------------------------------------------------------------------
  perform pg_temp.as_user(v_user);
  update public.matches set status = 'OPEN' where id = v_match;
  perform pg_temp.as_owner();
  if (select status from public.matches where id = v_match) <> 'UPCOMING' then raise exception 'FAIL [a player changed the match status]'; end if;

  -- Once an admin opens it, registration works -----------------------------------------------------------------------
  perform pg_temp.as_user(v_admin);
  update public.matches set status = 'OPEN' where id = v_match;
  perform pg_temp.as_user(v_user);
  if pg_temp.register_result(v_match) <> 'OK' then raise exception 'FAIL [registering after opening should work]'; end if;

  -- An admin can unpublish a match back to DRAFT ------------------------------------------------------------------
  perform pg_temp.as_owner();
  update public.matches set status = 'UPCOMING' where id = v_match;
  perform pg_temp.as_user(v_admin);
  update public.matches set status = 'DRAFT' where id = v_match;
  if (select status from public.matches where id = v_match) <> 'DRAFT' then raise exception 'FAIL [admin could not move UPCOMING back to DRAFT]'; end if;

  -- Nonsense statuses are still refused ---------------------------------------------------------------------------
  begin
    update public.matches set status = 'SOON' where id = v_match;
    raise exception 'FAIL [an unknown status was accepted]';
  exception when check_violation then null;
  end;
end $$;

select 'ALL PHASE 21 TESTS PASSED' as result;

rollback;
