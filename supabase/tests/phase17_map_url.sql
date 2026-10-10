-- Phase 17 database tests (migration 0017): the match map link. Paste into the Supabase SQL Editor and Run.
-- Everything happens inside a transaction that is ROLLED BACK at the end, so no data is kept.
-- Success: the final result shows "ALL PHASE 17 TESTS PASSED". Any failure raises an error naming the check.

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

-- True when saving this link on the match is accepted by the database.
create or replace function pg_temp.accepts(p_match uuid, p_url text) returns boolean language plpgsql as $$
begin
  update public.matches set map_url = p_url where id = p_match;
  return true;
exception when check_violation then
  return false;
end $$;

do $$
declare
  v_admin uuid := gen_random_uuid();
  v_user  uuid := gen_random_uuid();
  v_match uuid;
begin
  insert into auth.users (id, aud, role, email, raw_user_meta_data)
  values (v_admin, 'authenticated', 'authenticated', 'phase17admin@example.com', jsonb_build_object('full_name', 'Admin', 'phone', '+910000001701')),
         (v_user,  'authenticated', 'authenticated', 'phase17user@example.com',  jsonb_build_object('full_name', 'Player', 'phone', '+910000001702'));
  update public.profiles set status = 'ACTIVE';
  update public.profiles set role = 'ADMIN' where id = v_admin;

  insert into public.matches (title, match_date, start_time, venue, max_players, status)
  values ('Phase17 Match', current_date + 7, '06:00', 'Test Turf', 10, 'OPEN') returning id into v_match;

  -- The rule itself ----------------------------------------------------------------------------------------
  if not pg_temp.accepts(v_match, null) then raise exception 'FAIL [empty link must be allowed]'; end if;
  if not pg_temp.accepts(v_match, 'https://maps.app.goo.gl/AbCd1234') then raise exception 'FAIL [maps.app.goo.gl link]'; end if;
  if not pg_temp.accepts(v_match, 'https://share.google/GJGrOzq250tKeY050') then raise exception 'FAIL [share.google link, needs migration 0018]'; end if;
  if pg_temp.accepts(v_match, 'https://share.google.evil.com/abc') then raise exception 'FAIL [share.google look-alike host must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://share.google/') then raise exception 'FAIL [share.google with no link must be refused]'; end if;
  if not pg_temp.accepts(v_match, 'https://goo.gl/maps/AbCd1234') then raise exception 'FAIL [goo.gl/maps link]'; end if;
  if not pg_temp.accepts(v_match, 'https://www.google.com/maps/place/Bellin+Turf/@8.5,76.9,17z') then raise exception 'FAIL [google.com/maps link]'; end if;
  if not pg_temp.accepts(v_match, 'https://www.google.com/maps?q=8.5,76.9') then raise exception 'FAIL [google.com/maps?q link]'; end if;
  if not pg_temp.accepts(v_match, 'https://maps.google.com/?q=8.5,76.9') then raise exception 'FAIL [maps.google.com link]'; end if;

  if pg_temp.accepts(v_match, 'http://maps.app.goo.gl/abc') then raise exception 'FAIL [plain http must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://example.com/maps/abc') then raise exception 'FAIL [other site must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://google.com.evil.com/maps/x') then raise exception 'FAIL [look-alike host must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://maps.app.goo.gl@evil.com/x') then raise exception 'FAIL [user-info trick must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://www.google.com/mapsfoo') then raise exception 'FAIL [/mapsfoo must be refused]'; end if;
  if pg_temp.accepts(v_match, 'javascript:alert(1)') then raise exception 'FAIL [javascript link must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://maps.app.goo.gl/abc def') then raise exception 'FAIL [spaces must be refused]'; end if;
  if pg_temp.accepts(v_match, 'https://maps.app.goo.gl/' || repeat('a', 500)) then raise exception 'FAIL [over-long link must be refused]'; end if;

  -- Who can read and write it -----------------------------------------------------------------------------------
  update public.matches set map_url = 'https://maps.app.goo.gl/AbCd1234' where id = v_match;

  perform pg_temp.as_user(v_user);
  if (select map_url from public.matches where id = v_match) is distinct from 'https://maps.app.goo.gl/AbCd1234' then
    raise exception 'FAIL [players must be able to read the map link]';
  end if;
  begin
    update public.matches set map_url = 'https://maps.app.goo.gl/changed' where id = v_match;
    if (select map_url from public.matches where id = v_match) is distinct from 'https://maps.app.goo.gl/AbCd1234' then
      raise exception 'FAIL [a player changed the map link]';
    end if;
  exception when insufficient_privilege then null;
  end;

  perform pg_temp.as_user(v_admin);
  update public.matches set map_url = 'https://maps.app.goo.gl/byadmin' where id = v_match;
  if (select map_url from public.matches where id = v_match) is distinct from 'https://maps.app.goo.gl/byadmin' then
    raise exception 'FAIL [an admin must be able to change the map link]';
  end if;

  perform pg_temp.as_owner();
  if not has_column_privilege('anon', 'public.matches', 'map_url', 'SELECT') then
    raise exception 'FAIL [logged-out visitors must be able to read the map link, like the venue]';
  end if;
  if has_column_privilege('anon', 'public.matches', 'map_url', 'UPDATE') then
    raise exception 'FAIL [logged-out visitors can change the map link]';
  end if;
end $$;

select 'ALL PHASE 17 TESTS PASSED' as result;

rollback;
