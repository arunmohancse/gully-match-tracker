-- Phase 15 database tests (migration 0015): overdue payments block new registrations. Paste into the Supabase SQL Editor and Run.
-- Everything happens inside a transaction that is ROLLED BACK at the end, so no data is kept.
-- Success: the final result shows "ALL PHASE 15 TESTS PASSED". Any failure raises an error naming the check.

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

-- True when register_for_match(m) is refused with PAYMENT_DUE for the current user.
create or replace function pg_temp.blocked(p_match uuid) returns boolean language plpgsql as $$
begin
  perform public.register_for_match(p_match);
  return false;
exception when others then
  if sqlerrm like '%PAYMENT_DUE%' then return true; end if;
  raise;
end $$;

-- A past match with the given cost model and one UNPAID main-list registration for the user (inserted as owner).
create or replace function pg_temp.owe(p_uid uuid, p_days_ago int, p_model text, p_amount numeric, p_pay text default 'UNPAID') returns uuid language plpgsql as $$
declare
  v_match uuid;
begin
  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status, cost_model)
  values ('Past ' || p_days_ago || 'd ' || p_model, current_date - p_days_ago, '06:00', 'Test Turf', 10,
          case when p_model = 'FIXED_FEE' then p_amount else 0 end, 'COMPLETED', p_model)
  returning id into v_match;
  insert into public.registrations (match_id, user_id, list_type, seq, payment_status, amount_due, payment_amount)
  values (v_match, p_uid, 'MAIN_LIST', 1, p_pay,
          case when p_model = 'SHARED_COST' then p_amount end,
          case when p_pay = 'PAID' then p_amount end);
  return v_match;
end $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 8));
  names text[] := array['Owes Old','Owes Recent','Paid Old','Waived Old','Shared Old','Shared Fresh','Free Old','Pays Later'];
  v_open uuid;
  v_old uuid;
  v_shared uuid;
  v_shared2 uuid;
  r record;
  i int;
begin
  for i in 1..8 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase15test' || i || '@example.com',
            jsonb_build_object('full_name', names[i], 'phone', '+9100000015' || i));
  end loop;
  update public.profiles set status = 'ACTIVE';

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status, cost_model)
  values ('Phase15 Open Match', current_date + 7, '06:00', 'Test Turf', 20, 100, 'OPEN', 'FIXED_FEE')
  returning id into v_open;

  -- Fixtures: who owes what -------------------------------------------------------------------------
  v_old := pg_temp.owe(u[1], 4, 'FIXED_FEE', 150);                 -- unpaid, 4 days ago: overdue
  perform pg_temp.owe(u[2], 2, 'FIXED_FEE', 150);                  -- unpaid, 2 days ago: still in the grace period
  perform pg_temp.owe(u[3], 10, 'FIXED_FEE', 150, 'PAID');         -- paid
  perform pg_temp.owe(u[4], 10, 'FIXED_FEE', 150, 'WAIVED');       -- waived
  v_shared := pg_temp.owe(u[5], 10, 'SHARED_COST', 120);           -- shared, match long ago ...
  insert into public.match_settlements (match_id, total_expenses, participants, exact_share, share_amount, calculated_at)
  values (v_shared, 120, 1, 120, 120, now() - interval '5 days');  -- ... shares calculated 5 days ago: overdue
  v_shared2 := pg_temp.owe(u[6], 10, 'SHARED_COST', 120);         -- shared, match long ago ...
  insert into public.match_settlements (match_id, total_expenses, participants, exact_share, share_amount, calculated_at)
  values (v_shared2, 120, 1, 120, 120, now() - interval '1 day');
                                                                    -- ... shares calculated only yesterday: still overdue, the clock runs from the match date
  perform pg_temp.owe(u[7], 10, 'SHARED_COST', null);              -- shared, shares not calculated (no amount): nothing known to owe
  perform pg_temp.owe(u[7], 10, 'FIXED_FEE', 0);                   -- a free match: nothing owed
  perform pg_temp.owe(u[8], 5, 'FIXED_FEE', 150);                  -- will be marked paid below

  -- Who is blocked -----------------------------------------------------------------------------------------
  perform pg_temp.as_user(u[1]);
  perform pg_temp.check_eq('unpaid for 4 days is blocked', pg_temp.blocked(v_open)::text, 'true');
  select * into r from public.my_payment_block();
  perform pg_temp.check_eq('summary count', r.overdue_count::text, '1');
  perform pg_temp.check_eq('summary total', r.overdue_total::text, '150.00');
  perform pg_temp.check_eq('summary oldest match', r.oldest_title, 'Past 4d FIXED_FEE');
  perform pg_temp.check_eq('summary grace days', r.grace_days::text, '3');

  perform pg_temp.as_user(u[2]);
  perform pg_temp.check_eq('unpaid for 2 days is not blocked', pg_temp.blocked(v_open)::text, 'false');
  select * into r from public.my_payment_block();
  perform pg_temp.check_eq('no summary when nothing overdue', r.overdue_count::text, '0');

  perform pg_temp.as_user(u[3]);
  perform pg_temp.check_eq('paid is not blocked', pg_temp.blocked(v_open)::text, 'false');
  perform pg_temp.as_user(u[4]);
  perform pg_temp.check_eq('waived is not blocked', pg_temp.blocked(v_open)::text, 'false');

  perform pg_temp.as_user(u[5]);
  perform pg_temp.check_eq('shared cost, shares calculated 5 days ago, is blocked', pg_temp.blocked(v_open)::text, 'true');
  perform pg_temp.as_user(u[6]);
  perform pg_temp.check_eq('shared cost, match 10 days ago, shares calculated only yesterday, is blocked (clock runs from the match date)', pg_temp.blocked(v_open)::text, 'true');
  perform pg_temp.as_user(u[7]);
  perform pg_temp.check_eq('free match is not blocked', pg_temp.blocked(v_open)::text, 'false');

  -- Lifting the block ---------------------------------------------------------------------------------------
  perform pg_temp.as_owner();
  update public.registrations set payment_status = 'PAID', payment_amount = 150 where id = (select id from public.registrations where user_id = u[1]);
  perform pg_temp.as_user(u[1]);
  perform pg_temp.check_eq('blocked player can register once marked paid', pg_temp.blocked(v_open)::text, 'false');

  -- Re-registering after a cancellation is blocked too -----------------------------------------------------------
  perform pg_temp.as_owner();
  update public.registrations set payment_status = 'UNPAID', payment_amount = null where user_id = u[8] and match_id <> v_open;
  perform pg_temp.as_user(u[8]);
  perform pg_temp.check_eq('unpaid for 5 days is blocked', pg_temp.blocked(v_open)::text, 'true');
  perform pg_temp.as_owner();
  update public.registrations set payment_status = 'PAID', payment_amount = 150 where user_id = u[8] and match_id <> v_open;
  perform pg_temp.as_user(u[8]);
  perform public.register_for_match(v_open);
  perform public.cancel_registration((select id from public.registrations where user_id = u[8] and match_id = v_open));
  perform pg_temp.as_owner();
  update public.registrations set payment_status = 'UNPAID', payment_amount = null where user_id = u[8] and match_id <> v_open;
  perform pg_temp.as_user(u[8]);
  perform pg_temp.check_eq('cannot come back after cancelling while overdue', pg_temp.blocked(v_open)::text, 'true');

  -- Already-registered players keep their spot (a retry of the same request is harmless) ------------------------------
  perform pg_temp.as_user(u[2]);
  perform public.register_for_match(v_open);
  perform pg_temp.as_owner();
  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status, cost_model)
  values ('Phase15 Older', current_date - 9, '06:00', 'Test Turf', 10, 150, 'COMPLETED', 'FIXED_FEE') returning id into v_old;
  insert into public.registrations (match_id, user_id, list_type, seq) values (v_old, u[2], 'MAIN_LIST', 1);
  perform pg_temp.as_user(u[2]);
  select * into r from public.register_for_match(v_open);
  perform pg_temp.check_eq('retry by an already-registered player still works', r.already_registered::text, 'true');

  -- Security -----------------------------------------------------------------------------------------------------
  perform pg_temp.as_user(u[1]);
  begin
    perform * from public.overdue_dues(u[2]);
    raise exception 'FAIL [overdue_dues]: clients must not call the internal function';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.payment_grace_days();
    raise exception 'FAIL [payment_grace_days]: clients must not call the internal function';
  exception when insufficient_privilege then null;
  end;
end $$;

select 'ALL PHASE 15 TESTS PASSED' as result;

rollback;
