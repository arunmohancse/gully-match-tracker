-- Phase 9: shared-cost matches. Safe to re-run.
--
-- A match has a cost model:
--   FIXED_FEE    a fixed fee per player (everything built before this migration; existing matches keep it)
--   SHARED_COST  no fee up front; total expenses are shared equally among the main-list players after the match
--                (new matches default to this)
--
-- For SHARED_COST an admin runs finalize_match_shares(): total expenses / main-list players, rounded UP to a step
-- (1, 5 or 10 rupees). The amount is stored per registration (amount_due) and payments are tracked against it.
-- A snapshot is kept in match_settlements (admin only) so we can tell when expenses or the player list change afterwards.

-- Columns --------------------------------------------------------------------------------------------------------
alter table public.matches add column if not exists cost_model text not null default 'FIXED_FEE'
  check (cost_model in ('FIXED_FEE', 'SHARED_COST'));
alter table public.matches alter column cost_model set default 'SHARED_COST';

alter table public.registrations add column if not exists amount_due numeric(10,2)
  check (amount_due is null or amount_due >= 0);

alter table public.communities add column if not exists payment_instructions text;

grant select (cost_model) on public.matches to anon, authenticated;
grant insert (cost_model) on public.matches to authenticated;
grant update (cost_model) on public.matches to authenticated;

-- Payment instructions (for example a UPI id) are visible to logged-in users only, editable by admins only.
revoke select on public.communities from anon, authenticated;
grant select (id, name, slug, timezone, created_at) on public.communities to anon;
grant select on public.communities to authenticated;
grant update (payment_instructions) on public.communities to authenticated;

-- A share only means something for the current main list: clear it when a registration leaves it.
create or replace function public.registrations_clear_amount_due()
returns trigger language plpgsql as $$
begin
  if new.status = 'CANCELLED' or new.list_type = 'WAITING_LIST'
     or (old.status = 'CANCELLED' and new.status = 'ACTIVE') then
    new.amount_due := null;
  end if;
  return new;
end $$;

drop trigger if exists registrations_clear_amount_due on public.registrations;
create trigger registrations_clear_amount_due before update of status, list_type on public.registrations
  for each row execute function public.registrations_clear_amount_due();

-- Settlement snapshot (admin only; written only by finalize_match_shares) ------------------------------------------
create table if not exists public.match_settlements (
  match_id       uuid primary key references public.matches(id),
  total_expenses numeric(10,2) not null check (total_expenses > 0),
  participants   integer not null check (participants > 0),
  exact_share    numeric(14,4) not null,
  share_amount   numeric(10,2) not null check (share_amount > 0),
  rounding_step  numeric(10,2) not null default 1 check (rounding_step > 0),
  calculated_at  timestamptz not null default now(),
  calculated_by  uuid references public.profiles(id) on delete set null
);

alter table public.match_settlements enable row level security;
drop policy if exists match_settlements_admin_select on public.match_settlements;
create policy match_settlements_admin_select on public.match_settlements for select using (public.is_admin());
revoke all on public.match_settlements from anon, authenticated;
grant select on public.match_settlements to authenticated;

-- ---------------------------------------------------------------------------
-- finalize_match_shares(match_id, step): total expenses shared equally, rounded up
-- ---------------------------------------------------------------------------
create or replace function public.finalize_match_shares(p_match_id uuid, p_step numeric default 1)
returns table (share_amount numeric, participants integer, total_expenses numeric, surplus numeric)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid   uuid := auth.uid();
  m       public.matches;
  v_total numeric;
  v_n     integer;
  v_exact numeric;
  v_share numeric;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_step is null or p_step <= 0 or p_step > 100 then
    raise exception 'INVALID_STEP' using errcode = 'P0001';
  end if;

  select * into m from public.matches where id = p_match_id for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;
  if m.cost_model <> 'SHARED_COST' then
    raise exception 'WRONG_COST_MODEL' using errcode = 'P0001';
  end if;
  -- The player list must be final before it is divided.
  if m.status not in ('CLOSED', 'COMPLETED') then
    raise exception 'MATCH_NOT_CLOSED' using errcode = 'P0001';
  end if;

  select coalesce(sum(amount), 0) into v_total from public.expenses where match_id = p_match_id;
  if v_total <= 0 then
    raise exception 'NO_EXPENSES' using errcode = 'P0001';
  end if;

  select count(*) into v_n from public.registrations
   where match_id = p_match_id and status = 'ACTIVE' and list_type = 'MAIN_LIST';
  if v_n = 0 then
    raise exception 'NO_PARTICIPANTS' using errcode = 'P0001';
  end if;

  v_exact := v_total / v_n;
  v_share := ceil(v_exact / p_step) * p_step;

  -- Existing payments are left alone; the admin sees any mismatch and decides what to do.
  update public.registrations
     set amount_due = case when status = 'ACTIVE' and list_type = 'MAIN_LIST' then v_share else null end
   where match_id = p_match_id and amount_due is distinct from
         (case when status = 'ACTIVE' and list_type = 'MAIN_LIST' then v_share else null end);

  insert into public.match_settlements (match_id, total_expenses, participants, exact_share, share_amount, rounding_step, calculated_at, calculated_by)
  values (p_match_id, v_total, v_n, v_exact, v_share, p_step, now(), v_uid)
  on conflict (match_id) do update
     set total_expenses = excluded.total_expenses, participants = excluded.participants, exact_share = excluded.exact_share,
         share_amount = excluded.share_amount, rounding_step = excluded.rounding_step,
         calculated_at = excluded.calculated_at, calculated_by = excluded.calculated_by;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (v_uid, 'SHARES_CALCULATED', 'match', p_match_id,
          jsonb_build_object('match_id', p_match_id, 'total_expenses', v_total, 'participants', v_n, 'share_amount', v_share, 'step', p_step));

  return query select v_share, v_n, v_total, v_share * v_n - v_total;
end $$;

revoke all on function public.finalize_match_shares(uuid, numeric) from public, anon;
grant execute on function public.finalize_match_shares(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_payment: marking PAID without an amount now records the amount due (shared cost) or the fee
-- ---------------------------------------------------------------------------
create or replace function public.admin_set_payment(
  p_registration_id uuid,
  p_status          text,
  p_amount          numeric default null,
  p_reference       text    default null,
  p_method          text    default null,
  p_notes           text    default null)
returns table (registration_id uuid, payment_status text, payment_amount numeric, paid_at timestamptz)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid    uuid := auth.uid();
  v_match  uuid;
  v_amount numeric;
  v_ref    text := nullif(btrim(p_reference), '');
  v_method text := nullif(btrim(p_method), '');
  v_notes  text := nullif(btrim(p_notes), '');
  m        public.matches;
  r        public.registrations;
  n        public.registrations;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_status not in ('UNPAID', 'PAID', 'REFUNDED', 'WAIVED') then
    raise exception 'INVALID_PAYMENT_STATUS' using errcode = 'P0001';
  end if;
  if p_amount is not null and p_amount < 0 then
    raise exception 'INVALID_AMOUNT' using errcode = 'P0001';
  end if;

  select match_id into v_match from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into m from public.matches where id = v_match for update;
  select * into r from public.registrations where id = p_registration_id for update;

  if r.status = 'CANCELLED' and p_status in ('PAID', 'WAIVED') then
    raise exception 'REGISTRATION_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if p_status = 'REFUNDED' and r.payment_status not in ('PAID', 'REFUNDED') then
    raise exception 'INVALID_PAYMENT_CHANGE' using errcode = 'P0001';
  end if;

  if p_status = 'PAID' then
    v_amount := coalesce(p_amount, r.amount_due, case when m.cost_model = 'FIXED_FEE' then m.registration_fee end);
    if v_amount is null then
      raise exception 'AMOUNT_REQUIRED' using errcode = 'P0001';   -- shared cost, shares not calculated yet
    end if;
    update public.registrations
       set payment_status = 'PAID', payment_amount = v_amount,
           paid_at = case when r.payment_status = 'PAID' then r.paid_at else now() end,
           payment_reference = v_ref, payment_method = v_method, payment_notes = v_notes
     where id = r.id;
  elsif p_status in ('UNPAID', 'WAIVED') then
    update public.registrations
       set payment_status = p_status, payment_amount = null, paid_at = null,
           payment_reference = null, payment_method = null, payment_notes = v_notes
     where id = r.id;
  else
    update public.registrations
       set payment_status = 'REFUNDED',
           payment_reference = coalesce(v_ref, payment_reference),
           payment_notes = coalesce(v_notes, payment_notes)
     where id = r.id;
  end if;

  select * into n from public.registrations where id = r.id;

  if (r.payment_status, r.payment_amount, r.payment_reference, r.payment_method)
       is distinct from (n.payment_status, n.payment_amount, n.payment_reference, n.payment_method) then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid,
            case p_status when 'PAID' then 'PAYMENT_MARKED_PAID'
                          when 'UNPAID' then 'PAYMENT_MARKED_UNPAID'
                          when 'REFUNDED' then 'PAYMENT_MARKED_REFUNDED'
                          else 'PAYMENT_WAIVED' end,
            'registration', r.id,
            jsonb_build_object('match_id', v_match, 'user_id', r.user_id, 'from', r.payment_status, 'to', n.payment_status,
                               'amount', n.payment_amount, 'method', n.payment_method, 'reference', n.payment_reference));
  end if;

  return query select n.id, n.payment_status, n.payment_amount, n.paid_at;
end $$;

-- ---------------------------------------------------------------------------
-- match_financials: now cost-model aware. (Return columns changed, so drop and recreate.)
-- ---------------------------------------------------------------------------
--   FIXED_FEE:   expected = main players x fee,        pending = unpaid players x fee
--   SHARED_COST: expected = sum of amount_due (main),   pending = sum of amount_due for unpaid players
--   shares_stale: the expenses or the main list changed after the shares were calculated
drop function if exists public.match_financials(uuid[]);

create function public.match_financials(p_match_ids uuid[])
returns table (
  match_id          uuid,
  cost_model        text,
  registration_fee  numeric,
  main_count        integer,
  waiting_count     integer,
  paid_count        integer,
  unpaid_count      integer,
  waived_count      integer,
  expected          numeric,
  collected         numeric,
  pending           numeric,
  refunds_due       numeric,
  expenses_total    numeric,
  balance           numeric,
  projected_balance numeric,
  shares_calculated boolean,
  shares_stale      boolean,
  share_amount      numeric,
  estimated_share   numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  return query
  with agg as (
    select m.id as mid, m.cost_model as model, m.registration_fee as fee,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST'))::integer    as mains,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'WAITING_LIST'))::integer as waits,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'PAID'))::integer   as paids,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'UNPAID'))::integer as unpaids,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'WAIVED'))::integer as waiveds,
           coalesce(sum(r.payment_amount) filter (where r.status = 'ACTIVE' and r.payment_status = 'PAID'), 0)    as collected_amt,
           coalesce(sum(r.payment_amount) filter (where r.status = 'CANCELLED' and r.payment_status = 'PAID'), 0) as refunds_amt,
           coalesce(sum(r.amount_due) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST'), 0)        as due_main,
           coalesce(sum(r.amount_due) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'UNPAID'), 0) as due_unpaid,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.amount_due is null))::integer as missing_due
      from public.matches m
      left join public.registrations r on r.match_id = m.id
     where m.id = any (p_match_ids)
     group by m.id, m.cost_model, m.registration_fee
  ), exp as (
    select e.match_id as mid, sum(e.amount) as total
      from public.expenses e
     where e.match_id = any (p_match_ids)
     group by e.match_id
  ), fin as (
    select a.*, coalesce(x.total, 0) as exp_total,
           case when a.model = 'SHARED_COST' then a.due_main else a.mains * a.fee end as expected_amt,
           case when a.model = 'SHARED_COST' then a.due_unpaid else a.unpaids * a.fee end as pending_amt
      from agg a left join exp x on x.mid = a.mid
  )
  select f.mid, f.model, f.fee, f.mains, f.waits, f.paids, f.unpaids, f.waiveds,
         f.expected_amt,
         f.collected_amt,
         f.pending_amt,
         f.refunds_amt,
         f.exp_total,
         f.collected_amt - f.exp_total,
         f.collected_amt + f.pending_amt - f.exp_total,
         (s.match_id is not null),
         (s.match_id is not null and (s.total_expenses is distinct from f.exp_total or s.participants <> f.mains or f.missing_due > 0)),
         s.share_amount,
         case when f.mains > 0 then f.exp_total / f.mains end
    from fin f
    left join public.match_settlements s on s.match_id = f.mid;
end $$;

revoke all on function public.match_financials(uuid[]) from public, anon;
grant execute on function public.match_financials(uuid[]) to authenticated;
