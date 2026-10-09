-- Phase 5 database tests (payments, financial totals, expenses, authorization). Requires migrations 0001-0006 (still valid after 0009: it tests the FIXED_FEE model).
-- Paste into the Supabase SQL Editor and Run. Runs in a transaction that is ROLLED BACK, so no data is kept.
-- Success: the final result shows "ALL PHASE 5 TESTS PASSED". Any failure raises an error naming the check.

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

create or replace function pg_temp.reg_field(p_match uuid, p_uid uuid, p_field text) returns text language plpgsql as $$
declare v text;
begin
  execute format('select %I::text from public.registrations where match_id = $1 and user_id = $2', p_field)
    into v using p_match, p_uid;
  return v;
end $$;

-- Admin-set payment, run as the given admin. Returns the resulting status.
create or replace function pg_temp.set_pay(p_admin uuid, p_rid uuid, p_status text, p_amount numeric default null,
                                           p_ref text default null, p_method text default null) returns text language plpgsql as $$
declare r record;
begin
  perform pg_temp.as_user(p_admin);
  select * into r from public.admin_set_payment(p_rid, p_status, p_amount, p_ref, p_method, null);
  perform pg_temp.as_owner();
  return r.payment_status;
end $$;

-- "paid|unpaid|waived|expected|collected|pending|refunds|expenses|balance|projected"
create or replace function pg_temp.fin(p_match uuid, p_admin uuid) returns text language plpgsql as $$
declare f record;
begin
  perform pg_temp.as_user(p_admin);
  select * into f from public.match_financials(array[p_match]);
  perform pg_temp.as_owner();
  return concat_ws('|', f.paid_count, f.unpaid_count, f.waived_count, f.expected::numeric(10,0), f.collected::numeric(10,0),
                   f.pending::numeric(10,0), f.refunds_due::numeric(10,0), f.expenses_total::numeric(10,0),
                   f.balance::numeric(10,0), f.projected_balance::numeric(10,0));
end $$;

do $$
declare
  u uuid[] := array(select gen_random_uuid() from generate_series(1, 7));
  i int;
  v_match uuid;
  v_exp1 uuid;
  v_exp2 uuid;
  v_paid_at timestamptz;
  admin uuid;
begin
  for i in 1..7 loop
    insert into auth.users (id, aud, role, email, raw_user_meta_data)
    values (u[i], 'authenticated', 'authenticated', 'phase5test' || i || '@example.com',
            jsonb_build_object('full_name', 'Player ' || i, 'phone', '+9100000200' || i));
  end loop;
  update public.profiles set role = 'ADMIN' where id = u[7];
  update public.profiles set status = 'ACTIVE';   -- new signups start PENDING (migration 0011)
  admin := u[7];

  insert into public.matches (title, match_date, start_time, venue, max_players, registration_fee, status, cost_model)
  values ('Phase5 Test Match', current_date + 7, '06:00', 'Test Turf', 3, 150, 'OPEN', 'FIXED_FEE') returning id into v_match;
  for i in 1..4 loop perform pg_temp.reg(u[i], v_match); end loop;   -- u1-u3 main, u4 waiting

  -- Totals format: paid|unpaid|waived|expected|collected|pending|refunds|expenses|balance|projected
  perform pg_temp.check_eq('initial totals', pg_temp.fin(v_match, admin), '0|3|0|450|0|450|0|0|0|450');

  -- ===== Unpaid -> paid ===============================================================================
  perform pg_temp.check_eq('default payment is UNPAID', pg_temp.reg_field(v_match, u[1], 'payment_status'), 'UNPAID');
  perform pg_temp.check_eq('mark paid', pg_temp.set_pay(admin, pg_temp.rid(v_match, u[1]), 'PAID'), 'PAID');
  perform pg_temp.check_eq('amount defaults to the fee', pg_temp.reg_field(v_match, u[1], 'payment_amount'), '150.00');
  perform pg_temp.check_eq('paid_at set', (pg_temp.reg_field(v_match, u[1], 'paid_at') is not null)::text, 'true');

  perform pg_temp.check_eq('mark paid with details', pg_temp.set_pay(admin, pg_temp.rid(v_match, u[2]), 'PAID', 100, 'UPI123', 'UPI'), 'PAID');
  perform pg_temp.check_eq('reference stored', pg_temp.reg_field(v_match, u[2], 'payment_reference'), 'UPI123');
  perform pg_temp.check_eq('method stored', pg_temp.reg_field(v_match, u[2], 'payment_method'), 'UPI');
  perform pg_temp.check_eq('totals after payments', pg_temp.fin(v_match, admin), '2|1|0|450|250|150|0|0|250|400');

  -- ===== Expenses and balance ===========================================================================
  perform pg_temp.as_user(admin);
  insert into public.expenses (match_id, description, category, amount) values (v_match, 'Turf', 'Turf', 200) returning id into v_exp1;
  insert into public.expenses (match_id, description, category, amount) values (v_match, 'Cricket balls', 'Equipment', 50) returning id into v_exp2;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('expense created_by is the admin', (select (created_by = admin)::text from public.expenses where id = v_exp1), 'true');
  perform pg_temp.check_eq('totals with expenses', pg_temp.fin(v_match, admin), '2|1|0|450|250|150|0|250|0|150');

  -- ===== Paid -> unpaid ===================================================================================
  perform pg_temp.check_eq('mark unpaid', pg_temp.set_pay(admin, pg_temp.rid(v_match, u[1]), 'UNPAID'), 'UNPAID');
  perform pg_temp.check_eq('unpaid clears amount', pg_temp.reg_field(v_match, u[1], 'payment_amount'), null);
  perform pg_temp.check_eq('unpaid clears paid_at', pg_temp.reg_field(v_match, u[1], 'paid_at'), null);
  perform pg_temp.check_eq('totals after reversal', pg_temp.fin(v_match, admin), '1|2|0|450|100|300|0|250|-150|150');

  -- ===== Waived ===============================================================================================
  perform pg_temp.check_eq('waive', pg_temp.set_pay(admin, pg_temp.rid(v_match, u[3]), 'WAIVED'), 'WAIVED');
  perform pg_temp.check_eq('totals with a waiver', pg_temp.fin(v_match, admin), '1|1|1|450|100|150|0|250|-150|0');

  -- ===== Cancelled after paying: refund is owed, then refunded =================================================
  perform pg_temp.as_user(u[2]);
  perform * from public.cancel_registration(pg_temp.rid(v_match, u[2]));   -- u4 is promoted
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('paid status survives cancellation', pg_temp.reg_field(v_match, u[2], 'payment_status'), 'PAID');
  perform pg_temp.check_eq('totals show refund due', pg_temp.fin(v_match, admin), '0|2|1|450|0|300|100|250|-250|50');

  perform pg_temp.check_eq('refund', pg_temp.set_pay(admin, pg_temp.rid(v_match, u[2]), 'REFUNDED'), 'REFUNDED');
  perform pg_temp.check_eq('refund keeps the amount as a record', pg_temp.reg_field(v_match, u[2], 'payment_amount'), '100.00');
  perform pg_temp.check_eq('totals after refund', pg_temp.fin(v_match, admin), '0|2|1|450|0|300|0|250|-250|50');

  -- ===== Invalid changes ================================================================================================
  begin
    perform pg_temp.set_pay(admin, pg_temp.rid(v_match, u[1]), 'REFUNDED');
    raise exception 'FAIL [refund of unpaid]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('refund of unpaid error', sqlerrm, 'INVALID_PAYMENT_CHANGE');
  end;
  begin
    perform pg_temp.set_pay(admin, pg_temp.rid(v_match, u[1]), 'PAID', -5);
    raise exception 'FAIL [negative amount]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('negative amount error', sqlerrm, 'INVALID_AMOUNT');
  end;
  begin
    perform pg_temp.set_pay(admin, pg_temp.rid(v_match, u[2]), 'PAID');
    raise exception 'FAIL [pay cancelled registration]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('pay cancelled error', sqlerrm, 'REGISTRATION_NOT_ACTIVE');
  end;
  begin
    perform pg_temp.set_pay(admin, pg_temp.rid(v_match, u[1]), 'MAYBE');
    raise exception 'FAIL [bad status]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.as_owner();
    perform pg_temp.check_eq('bad status error', sqlerrm, 'INVALID_PAYMENT_STATUS');
  end;

  -- ===== Re-registering after a refund starts fresh ========================================================================
  perform pg_temp.reg(u[2], v_match);
  perform pg_temp.check_eq('payment reset after refund + re-register', pg_temp.reg_field(v_match, u[2], 'payment_status'), 'UNPAID');
  perform pg_temp.check_eq('amount reset', pg_temp.reg_field(v_match, u[2], 'payment_amount'), null);

  -- ===== Idempotent payment changes (no duplicate audit, paid_at preserved) ===============================================
  perform pg_temp.set_pay(admin, pg_temp.rid(v_match, u[4]), 'PAID');
  v_paid_at := pg_temp.reg_field(v_match, u[4], 'paid_at')::timestamptz;
  perform pg_temp.set_pay(admin, pg_temp.rid(v_match, u[4]), 'PAID');
  perform pg_temp.check_eq('paid_at preserved on repeat', (pg_temp.reg_field(v_match, u[4], 'paid_at')::timestamptz = v_paid_at)::text, 'true');

  -- ===== Expense edit and delete ================================================================================================
  perform pg_temp.as_user(admin);
  update public.expenses set amount = 300 where id = v_exp1;
  delete from public.expenses where id = v_exp2;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('expenses total after edit + delete', (select sum(amount)::numeric(10,0)::text from public.expenses where match_id = v_match), '300');

  -- ===== Authorization: a plain USER can do none of this ===============================================================
  perform pg_temp.as_user(u[1]);
  begin
    perform * from public.admin_set_payment(pg_temp.rid(v_match, u[1]), 'PAID');
    raise exception 'FAIL [user marks own payment]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('user payment error', sqlerrm, 'NOT_ALLOWED');
  end;
  begin
    perform * from public.match_financials(array[v_match]);
    raise exception 'FAIL [user reads financials]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
    perform pg_temp.check_eq('user financials error', sqlerrm, 'NOT_ALLOWED');
  end;
  perform pg_temp.check_eq('user cannot read expenses', (select count(*) from public.expenses)::text, '0');
  begin
    insert into public.expenses (match_id, description, category, amount) values (v_match, 'sneaky', 'Other', 1);
    raise exception 'FAIL [user adds expense]: should have been rejected';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  begin
    update public.registrations set payment_status = 'PAID' where user_id = u[1];
    raise exception 'FAIL [direct payment update]: should have been denied';
  exception when others then
    if sqlerrm like 'FAIL%' then raise; end if;
  end;
  perform pg_temp.as_owner();
  perform pg_temp.check_eq('user payment still unpaid', pg_temp.reg_field(v_match, u[1], 'payment_status'), 'UNPAID');

  -- ===== Audit trail (this transaction only) ============================================================================
  perform pg_temp.check_eq('audit paid', (select count(*)::text from public.audit_logs where action = 'PAYMENT_MARKED_PAID' and created_at = now()), '3');
  perform pg_temp.check_eq('audit unpaid', (select count(*)::text from public.audit_logs where action = 'PAYMENT_MARKED_UNPAID' and created_at = now()), '1');
  perform pg_temp.check_eq('audit waived', (select count(*)::text from public.audit_logs where action = 'PAYMENT_WAIVED' and created_at = now()), '1');
  perform pg_temp.check_eq('audit refunded', (select count(*)::text from public.audit_logs where action = 'PAYMENT_MARKED_REFUNDED' and created_at = now()), '1');
  perform pg_temp.check_eq('audit expenses', (select string_agg(action, ',' order by action) from public.audit_logs
            where action like 'EXPENSE_%' and created_at = now()), 'EXPENSE_ADDED,EXPENSE_ADDED,EXPENSE_DELETED,EXPENSE_UPDATED');
end $$;

select 'ALL PHASE 5 TESTS PASSED' as result;

rollback;
