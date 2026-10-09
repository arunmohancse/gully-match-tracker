-- Phase 4 database tests (cancellation, promotion, admin moves, capacity). Requires migrations 0001-0005.
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 4 TESTS PASSED". Any failure raises an error naming the check.

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

create or replace function pg_temp.mk_match(p_cap int) returns uuid language plpgsql as $$
declare v uuid;
begin
  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase4 Test Match', current_date + 7, '06:00', 'Test Turf', p_cap, 150, 'OPEN') returning id into v;
  return v;
end $$;

create or replace function pg_temp.reg(p_uid uuid, p_match uuid) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(p_uid);
  perform * from public.register_for_match(p_match);
  perform pg_temp.as_owner();
end $$;

create or replace function pg_temp.rid(p_match uuid, p_uid uuid) returns uuid language sql as $$
  select id from public.registrations where match_id = p_match and user_id = p_uid;
$$;

-- e.g. 'MAIN_LIST#2', 'WAITING_LIST#1', 'CANCELLED'
create or replace function pg_temp.pos(p_match uuid, p_uid uuid) returns text language sql as $$
  select case when status = 'ACTIVE' then list_type || '#' || list_position else status end
    from public.registrations where match_id = p_match and user_id = p_uid;
$$;

create or replace function pg_temp.mstatus(p_match uuid) returns text language sql as $$
  select status from public.matches where id = p_match;
$$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  i int;
  v_match uuid;
  v_first_rid uuid;
  res record;
begin
  for i in 1..7 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase4test' || i || '@example.com',
            jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000100' || i));
  end loop;
  update public.profiles set role = 'ADMIN' where id = u[7];
  update public.profiles set status = 'ACTIVE';   -- new signups start PENDING (migration 0011)

  -- ===== A. Main-list player cancels: first waiting player is promoted ================================
  v_match := pg_temp.mk_match(3);
  for i in 1..5 loop perform pg_temp.reg(u[i], v_match); end loop;
  perform pg_temp.check_eq('A setup u4', pg_temp.pos(v_match, u[4]), 'WAITING_LIST#1');
  perform pg_temp.check_eq('A setup u5', pg_temp.pos(v_match, u[5]), 'WAITING_LIST#2');

  perform pg_temp.as_user(u[2]);
  select * into res from public.cancel_registration(pg_temp.rid(v_match, u[2]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('A status cancelled', res.status, 'CANCELLED');
  perform pg_temp.check_eq('A promoted count', res.promoted_count::text, '1');
  perform pg_temp.check_eq('A cancelled player', pg_temp.pos(v_match, u[2]), 'CANCELLED');
  perform pg_temp.check_eq('A promoted player', pg_temp.pos(v_match, u[4]), 'MAIN_LIST#3');
  perform pg_temp.check_eq('A remaining waiting', pg_temp.pos(v_match, u[5]), 'WAITING_LIST#1');
  perform pg_temp.check_eq('A main positions renumbered', pg_temp.pos(v_match, u[3]), 'MAIN_LIST#2');
  perform pg_temp.check_eq('A still full', pg_temp.mstatus(v_match), 'FULL');

  -- ===== B. Waiting-list player cancels: nobody moves ===================================================
  perform pg_temp.as_user(u[5]);
  select * into res from public.cancel_registration(pg_temp.rid(v_match, u[5]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('B promoted count', res.promoted_count::text, '0');
  perform pg_temp.check_eq('B main unchanged', pg_temp.pos(v_match, u[4]), 'MAIN_LIST#3');

  -- ===== C. Main player cancels with nobody waiting: capacity becomes available =========================
  perform pg_temp.as_user(u[1]);
  perform * from public.cancel_registration(pg_temp.rid(v_match, u[1]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('C match reopens', pg_temp.mstatus(v_match), 'OPEN');
  perform pg_temp.reg(u[6], v_match);
  perform pg_temp.check_eq('C new player takes the slot', pg_temp.pos(v_match, u[6]), 'MAIN_LIST#3');
  perform pg_temp.check_eq('C full again', pg_temp.mstatus(v_match), 'FULL');

  -- Idempotent: cancelling twice is not an error and promotes nobody
  perform pg_temp.as_user(u[1]);
  select * into res from public.cancel_registration(pg_temp.rid(v_match, u[1]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('C idempotent cancel', res.promoted_count::text, '0');

  -- ===== D. Authorization ======================================================================================
  -- Look the id up as the owner: RLS (correctly) hides other players' rows from u3.
  v_first_rid := pg_temp.rid(v_match, u[6]);
  perform pg_temp.as_user(u[3]);
  begin
    perform * from public.cancel_registration(v_first_rid);
    raise exception 'FAIL [cancel other player]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('D other-player error', sqlerrm, 'NOT_ALLOWED');
  end;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('D other player unaffected', pg_temp.pos(v_match, u[6]), 'MAIN_LIST#3');

  -- Admin can cancel someone else's registration
  perform pg_temp.as_user(u[7]);
  perform * from public.cancel_registration(pg_temp.rid(v_match, u[6]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('D admin cancel', pg_temp.pos(v_match, u[6]), 'CANCELLED');

  -- Players cannot cancel once registration is closed, admins still can
  update public.matches set status = 'CLOSED' where id = v_match;
  perform pg_temp.as_user(u[3]);
  begin
    perform * from public.cancel_registration(pg_temp.rid(v_match, u[3]));
    raise exception 'FAIL [cancel when closed]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('D closed error', sqlerrm, 'CANCELLATION_CLOSED');
  end;
  perform pg_temp.as_user(u[7]);
  perform * from public.cancel_registration(pg_temp.rid(v_match, u[3]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('D admin cancels when closed', pg_temp.pos(v_match, u[3]), 'CANCELLED');

  -- ===== E. Re-registering after cancelling reuses the row and joins the back of the queue ==================
  update public.matches set status = 'OPEN' where id = v_match;
  v_first_rid := pg_temp.rid(v_match, u[2]);
  perform pg_temp.reg(u[2], v_match);
  perform pg_temp.check_eq('E same row reused', (pg_temp.rid(v_match, u[2]) = v_first_rid)::text, 'true');
  perform pg_temp.check_eq('E gets a main slot (room available)', split_part(pg_temp.pos(v_match, u[2]), '#', 1), 'MAIN_LIST');

  -- ===== F. Admin moves ============================================================================================
  v_match := pg_temp.mk_match(3);
  for i in 1..5 loop perform pg_temp.reg(u[i], v_match); end loop;

  perform pg_temp.as_user(u[1]);
  begin
    perform * from public.admin_move_registration(pg_temp.rid(v_match, u[3]), 'WAITING_LIST');
    raise exception 'FAIL [user move]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('F user move error', sqlerrm, 'NOT_ALLOWED');
  end;

  -- Move main#3 to waiting: goes to the end, first waiting player (u4) moves up
  perform pg_temp.as_user(u[7]);
  perform * from public.admin_move_registration(pg_temp.rid(v_match, u[3]), 'WAITING_LIST');
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('F demoted to end of waiting', pg_temp.pos(v_match, u[3]), 'WAITING_LIST#2');
  perform pg_temp.check_eq('F first waiting promoted', pg_temp.pos(v_match, u[4]), 'MAIN_LIST#3');
  perform pg_temp.check_eq('F other waiting moves up', pg_temp.pos(v_match, u[5]), 'WAITING_LIST#1');

  -- Promote without a free slot needs a swap partner
  perform pg_temp.as_user(u[7]);
  begin
    perform * from public.admin_move_registration(pg_temp.rid(v_match, u[5]), 'MAIN_LIST');
    raise exception 'FAIL [promote when full]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('F full error', sqlerrm, 'MAIN_LIST_FULL');
  end;

  -- Swap: u3 (waiting #2) replaces u1 (main #1). u1 goes to the front of the waiting list.
  perform * from public.admin_move_registration(pg_temp.rid(v_match, u[3]), 'MAIN_LIST', pg_temp.rid(v_match, u[1]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('F swapped in', pg_temp.pos(v_match, u[3]), 'MAIN_LIST#3');
  perform pg_temp.check_eq('F swapped out', pg_temp.pos(v_match, u[1]), 'WAITING_LIST#1');
  perform pg_temp.check_eq('F rest of waiting', pg_temp.pos(v_match, u[5]), 'WAITING_LIST#2');
  perform pg_temp.check_eq('F main still full', pg_temp.mstatus(v_match), 'FULL');

  -- Nothing to promote: demotion is refused
  v_match := pg_temp.mk_match(2);
  perform pg_temp.reg(u[1], v_match);
  perform pg_temp.reg(u[2], v_match);
  perform pg_temp.as_user(u[7]);
  begin
    perform * from public.admin_move_registration(pg_temp.rid(v_match, u[2]), 'WAITING_LIST');
    raise exception 'FAIL [demote with empty waiting list]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('F empty waiting error', sqlerrm, 'NO_WAITING_PLAYERS');
  end;
  perform pg_temp.as_owner();

  -- ===== G. Capacity changes ==============================================================================================
  v_match := pg_temp.mk_match(2);
  for i in 1..4 loop perform pg_temp.reg(u[i], v_match); end loop;
  perform pg_temp.check_eq('G setup', pg_temp.pos(v_match, u[3]), 'WAITING_LIST#1');

  update public.matches set max_players = 3 where id = v_match;
  perform pg_temp.check_eq('G capacity+1 promotes', pg_temp.pos(v_match, u[3]), 'MAIN_LIST#3');
  perform pg_temp.check_eq('G remaining waiting', pg_temp.pos(v_match, u[4]), 'WAITING_LIST#1');
  perform pg_temp.check_eq('G still full', pg_temp.mstatus(v_match), 'FULL');

  begin
    update public.matches set max_players = 2 where id = v_match;
    raise exception 'FAIL [capacity below registered]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('G capacity error', sqlerrm, 'CAPACITY_BELOW_REGISTERED');
  end;

  update public.matches set max_players = 10 where id = v_match;
  perform pg_temp.check_eq('G big increase promotes all', pg_temp.pos(v_match, u[4]), 'MAIN_LIST#4');
  perform pg_temp.check_eq('G match reopens', pg_temp.mstatus(v_match), 'OPEN');

  -- ===== H. Audit ==================================================================================================================
  perform pg_temp.check_eq('H promotions audited', (select (count(*) > 0)::text from public.audit_logs where action = 'PLAYER_PROMOTED' and created_at = now()), 'true');
  perform pg_temp.check_eq('H cancellations audited', (select (count(*) = 5)::text from public.audit_logs where action = 'REGISTRATION_CANCELLED' and created_at = now()), 'true');
  perform pg_temp.check_eq('H moves audited', (select count(*)::text from public.audit_logs where action = 'PLAYER_MOVED' and created_at = now()), '2');
end $$;

select 'ALL PHASE 4 TESTS PASSED' as result;

rollback;
