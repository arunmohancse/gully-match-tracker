-- Phase 9 database tests (shared-cost settlement). Requires migrations 0001-0009.
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 9 TESTS PASSED".

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

create or replace function pg_temp.reg(p_uid uuid, p_match uuid) returns void language plpgsql as $$
begin
  perform pg_temp.as_user(p_uid);
  perform * from public.register_for_match(p_match);
  perform pg_temp.as_owner();
end $$;

create or replace function pg_temp.rid(p_match uuid, p_uid uuid) returns uuid language sql as $$
  select id from public.registrations where match_id = p_match and user_id = p_uid;
$$;

create or replace function pg_temp.field(p_match uuid, p_uid uuid, p_field text) returns text language plpgsql as $$
declare v text;
begin
  execute format('select %I::text from public.registrations where match_id = $1 and user_id = $2', p_field) into v using p_match, p_uid;
  return v;
end $$;

-- Runs finalize as the admin and returns "share|participants|total|surplus"
create or replace function pg_temp.finalize(p_admin uuid, p_match uuid, p_step numeric default 1) returns text language plpgsql as $$
declare r record;
begin
  perform pg_temp.as_user(p_admin);
  select * into r from public.finalize_match_shares(p_match, p_step);
  perform pg_temp.as_owner();
  return concat_ws('|', r.share_amount::numeric(10,2), r.participants, r.total_expenses::numeric(10,2), r.surplus::numeric(10,2));
end $$;

-- "model|calculated|stale|share|expected|pending|collected|balance|projected"
create or replace function pg_temp.fin(p_admin uuid, p_match uuid) returns text language plpgsql as $$
declare f record;
begin
  perform pg_temp.as_user(p_admin);
  select * into f from public.match_financials(array[p_match]);
  perform pg_temp.as_owner();
  return concat_ws('|', f.cost_model, f.shares_calculated::text, f.shares_stale::text, coalesce(f.share_amount::numeric(10,2)::text, '-'),
                   f.expected::numeric(10,2), f.pending::numeric(10,2), f.collected::numeric(10,2), f.balance::numeric(10,2),
                   f.projected_balance::numeric(10,2));
end $$;

create or replace function pg_temp.est(p_admin uuid, p_match uuid) returns text language plpgsql as $$
declare f record;
begin
  perform pg_temp.as_user(p_admin);
  select * into f from public.match_financials(array[p_match]);
  perform pg_temp.as_owner();
  return f.estimated_share::numeric(10,2)::text;
end $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  i int;
  admin uuid;
  v_match uuid;
  v_empty uuid;
  v_fixed uuid;
  res record;
begin
  for i in 1..7 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase9test' || i || '@example.com',
            jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000400' || i));
  end loop;
  update public.profiles set role = 'ADMIN' where id = u[7];
  update public.profiles set status = 'ACTIVE';   -- new signups start PENDING (migration 0011)
  admin := u[7];

  -- New matches default to the shared-cost model
  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase9 Shared Match', current_date + 7, '06:00', 'Test Turf', 3, 0, 'OPEN') returning id into v_match;
  perform pg_temp.check_eq('new matches are shared-cost by default', (select cost_model from public.matches where id = v_match), 'SHARED_COST');
  for i in 1..4 loop perform pg_temp.reg(u[i], v_match); end loop;   -- u1-u3 main, u4 waiting

  -- Expenses: 2000 + 600 + 200 = 2800
  insert into public.expenses (match_id, description, category, amount) values
    (v_match, 'Turf', 'Turf', 2000), (v_match, 'Balls', 'Equipment', 600), (v_match, 'Water', 'Water', 200);

  -- Before calculating: an estimate only, nothing is owed yet
  perform pg_temp.check_eq('before calculation', pg_temp.fin(admin, v_match), 'SHARED_COST|false|false|-|0.00|0.00|0.00|-2800.00|-2800.00');
  perform pg_temp.check_eq('estimate is total / main players', pg_temp.est(admin, v_match), '933.33');

  -- ===== Calculation is gated =====================================================================================
  begin
    perform pg_temp.finalize(admin, v_match);
    raise exception 'FAIL [open match]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('open match error', sqlerrm, 'MATCH_NOT_CLOSED');
  end;

  update public.matches set status = 'CLOSED' where id = v_match;

  begin
    perform pg_temp.finalize(u[1], v_match);
    raise exception 'FAIL [user finalize]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('user error', sqlerrm, 'NOT_ALLOWED');
  end;
  begin
    perform pg_temp.finalize(admin, v_match, 0);
    raise exception 'FAIL [zero step]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('step error', sqlerrm, 'INVALID_STEP');
  end;

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase9 No Expenses', current_date + 7, '06:00', 'Test Turf', 3, 0, 'CLOSED') returning id into v_empty;
  perform pg_temp.as_owner();
  begin
    perform pg_temp.finalize(admin, v_empty);
    raise exception 'FAIL [no expenses]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('no-expenses error', sqlerrm, 'NO_EXPENSES');
  end;

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status, cost_model)
  values ('Phase9 Fixed Fee', current_date + 7, '06:00', 'Test Turf', 3, 150, 'CLOSED', 'FIXED_FEE') returning id into v_fixed;
  begin
    perform pg_temp.finalize(admin, v_fixed);
    raise exception 'FAIL [fixed-fee match]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('wrong-model error', sqlerrm, 'WRONG_COST_MODEL');
  end;

  -- ===== Calculation: 2800 / 3 = 933.33 -> 934, surplus 2 =========================================================
  perform pg_temp.check_eq('calculate (step 1)', pg_temp.finalize(admin, v_match), '934.00|3|2800.00|2.00');
  perform pg_temp.check_eq('main players owe the share', pg_temp.field(v_match, u[1], 'amount_due'), '934.00');
  perform pg_temp.check_eq('waiting player owes nothing', pg_temp.field(v_match, u[4], 'amount_due'), null);
  perform pg_temp.check_eq('after calculation', pg_temp.fin(admin, v_match), 'SHARED_COST|true|false|934.00|2802.00|2802.00|0.00|-2800.00|2.00');

  -- Players can read their own amount due, and nobody else's
  perform pg_temp.as_user(u[1]);
  perform pg_temp.check_eq('player sees own share', (select amount_due::text from public.registrations), '934.00');
  perform pg_temp.check_eq('player cannot read settlements', (select count(*)::text from public.match_settlements), '0');
  perform pg_temp.as_owner();

  -- ===== Payments use the amount due ===================================================================================
  perform pg_temp.as_user(admin);
  perform * from public.admin_set_payment(pg_temp.rid(v_match, u[1]), 'PAID');
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('paid defaults to the share', pg_temp.field(v_match, u[1], 'payment_amount'), '934.00');
  perform pg_temp.check_eq('totals after one payment', pg_temp.fin(admin, v_match), 'SHARED_COST|true|false|934.00|2802.00|1868.00|934.00|-1866.00|2.00');

  -- ===== Rounding step 5: 933.33 -> 935 ==================================================================================
  perform pg_temp.check_eq('recalculate (step 5)', pg_temp.finalize(admin, v_match, 5), '935.00|3|2800.00|5.00');
  perform pg_temp.check_eq('existing payment is untouched', pg_temp.field(v_match, u[1], 'payment_amount'), '934.00');
  perform pg_temp.check_eq('amount due updated', pg_temp.field(v_match, u[2], 'amount_due'), '935.00');

  -- ===== Staleness: expenses change, then the main list changes ===============================================================
  insert into public.expenses (match_id, description, category, amount) values (v_match, 'Refreshments', 'Other', 100);
  perform pg_temp.check_eq('stale after a new expense', split_part(pg_temp.fin(admin, v_match), '|', 3), 'true');
  perform pg_temp.check_eq('recalculate (2900 / 3 = 966.67 -> 970)', pg_temp.finalize(admin, v_match, 5), '970.00|3|2900.00|10.00');
  perform pg_temp.check_eq('fresh after recalculation', split_part(pg_temp.fin(admin, v_match), '|', 3), 'false');

  -- A main-list player cancels: their share is cleared, the waiting player is promoted without one
  perform pg_temp.as_user(admin);
  perform * from public.cancel_registration(pg_temp.rid(v_match, u[2]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('cancelled player has no share', pg_temp.field(v_match, u[2], 'amount_due'), null);
  perform pg_temp.check_eq('promoted player has no share yet', pg_temp.field(v_match, u[4], 'amount_due'), null);
  perform pg_temp.check_eq('stale after the main list changed', split_part(pg_temp.fin(admin, v_match), '|', 3), 'true');
  perform pg_temp.check_eq('recalculate for the new list', pg_temp.finalize(admin, v_match, 5), '970.00|3|2900.00|10.00');
  perform pg_temp.check_eq('promoted player now owes a share', pg_temp.field(v_match, u[4], 'amount_due'), '970.00');
  perform pg_temp.check_eq('fresh again', split_part(pg_temp.fin(admin, v_match), '|', 3), 'false');

  -- Moving a main-list player to the waiting list clears their share too
  perform pg_temp.as_user(admin);
  perform * from public.cancel_registration(pg_temp.rid(v_match, u[4]));
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('no share after cancelling', pg_temp.field(v_match, u[4], 'amount_due'), null);

  -- ===== Payment instructions are private to logged-in users, editable by admins only ==========================================
  update public.communities set payment_instructions = 'UPI: club@upi' where id = (select community_id from public.matches where id = v_match);
  perform pg_temp.as_user(u[1]);
  perform pg_temp.check_eq('player can read instructions', (select count(*)::text from public.communities where payment_instructions = 'UPI: club@upi'), '1');
  update public.communities set payment_instructions = 'hacked';
  perform pg_temp.check_eq('player cannot edit instructions', (select count(*)::text from public.communities where payment_instructions = 'hacked'), '0');
  perform pg_temp.as_user(admin);
  update public.communities set payment_instructions = 'UPI: new@upi' where id = (select community_id from public.matches where id = v_match);
  perform pg_temp.check_eq('admin can edit instructions', (select count(*)::text from public.communities where payment_instructions = 'UPI: new@upi'), '1');
  perform pg_temp.as_owner();

  -- Marking a shared-cost payment with no share calculated and no amount is refused
  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status)
  values ('Phase9 Uncalculated', current_date + 7, '06:00', 'Test Turf', 3, 0, 'OPEN') returning id into v_empty;
  perform pg_temp.reg(u[1], v_empty);
  begin
    perform pg_temp.as_user(admin);
    perform * from public.admin_set_payment(pg_temp.rid(v_empty, u[1]), 'PAID');
    raise exception 'FAIL [pay before calculation]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('amount required error', sqlerrm, 'AMOUNT_REQUIRED');
  end;

  -- ===== Audit =============================================================================================================
  perform pg_temp.check_eq('shares audited', (select count(*)::text from public.audit_logs where action = 'SHARES_CALCULATED' and created_at = now()), '4');
end $$;

select 'ALL PHASE 9 TESTS PASSED' as result;

rollback;
