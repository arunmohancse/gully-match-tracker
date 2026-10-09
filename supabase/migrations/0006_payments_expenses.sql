-- Phase 5: payment changes (admin RPC), match financials, expenses.
-- Safe to re-run.
--
-- Money rules
--   expected  = main-list players x fee
--   collected = sum of payment_amount for ACTIVE registrations marked PAID
--   pending   = fee x main-list players still UNPAID   (WAIVED players are neither pending nor collected)
--   refunds_due = PAID amounts held for CANCELLED registrations (shown separately until marked REFUNDED)
--   balance           = collected - expenses
--   projected_balance = collected + pending - expenses   ("if everyone pays")

-- ---------------------------------------------------------------------------
-- Expenses (admin only)
-- ---------------------------------------------------------------------------
create table if not exists public.expenses (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id),
  description text not null check (length(btrim(description)) > 0),
  category    text not null default 'Other' check (length(btrim(category)) > 0),
  amount      numeric(10,2) not null check (amount > 0),
  created_by  uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists expenses_match_idx on public.expenses (match_id, created_at);

drop trigger if exists expenses_set_updated_at on public.expenses;
create trigger expenses_set_updated_at before update on public.expenses
  for each row execute function public.set_updated_at();

create or replace function public.expenses_before_insert()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.created_by := auth.uid();
  return new;
end $$;

drop trigger if exists expenses_before_insert on public.expenses;
create trigger expenses_before_insert before insert on public.expenses
  for each row execute function public.expenses_before_insert();

create or replace function public.audit_expense_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'EXPENSE_ADDED', 'expense', new.id,
            jsonb_build_object('match_id', new.match_id, 'description', new.description, 'category', new.category, 'amount', new.amount));
  elsif tg_op = 'UPDATE' then
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'EXPENSE_UPDATED', 'expense', new.id,
            jsonb_build_object('match_id', new.match_id,
                               'from', jsonb_build_object('description', old.description, 'category', old.category, 'amount', old.amount),
                               'to',   jsonb_build_object('description', new.description, 'category', new.category, 'amount', new.amount)));
  else
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'EXPENSE_DELETED', 'expense', old.id,
            jsonb_build_object('match_id', old.match_id, 'description', old.description, 'category', old.category, 'amount', old.amount));
    return old;
  end if;
  return new;
end $$;

drop trigger if exists expenses_audit on public.expenses;
create trigger expenses_audit after insert or update or delete on public.expenses
  for each row execute function public.audit_expense_change();

alter table public.expenses enable row level security;
drop policy if exists expenses_admin_all on public.expenses;
create policy expenses_admin_all on public.expenses for all
  using (public.is_admin()) with check (public.is_admin());

revoke all on public.expenses from anon, authenticated;
grant select, delete on public.expenses to authenticated;
grant insert (match_id, description, category, amount) on public.expenses to authenticated;
grant update (description, category, amount) on public.expenses to authenticated;

-- ---------------------------------------------------------------------------
-- admin_set_payment: the only way payment fields change
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

  -- Same lock order as every other mutation: match first, then the registration.
  select * into m from public.matches where id = v_match for update;
  select * into r from public.registrations where id = p_registration_id for update;

  if r.status = 'CANCELLED' and p_status in ('PAID', 'WAIVED') then
    raise exception 'REGISTRATION_NOT_ACTIVE' using errcode = 'P0001';
  end if;
  if p_status = 'REFUNDED' and r.payment_status not in ('PAID', 'REFUNDED') then
    raise exception 'INVALID_PAYMENT_CHANGE' using errcode = 'P0001';
  end if;

  if p_status = 'PAID' then
    v_amount := coalesce(p_amount, m.registration_fee);
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
  else  -- REFUNDED keeps the original amount / paid_at as the record of what was returned
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
-- match_financials: per-match counts and money totals (admin only)
-- ---------------------------------------------------------------------------
create or replace function public.match_financials(p_match_ids uuid[])
returns table (
  match_id          uuid,
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
  projected_balance numeric)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  return query
  with agg as (
    select m.id as mid, m.registration_fee as fee,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST'))::integer    as mains,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'WAITING_LIST'))::integer as waits,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'PAID'))::integer   as paids,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'UNPAID'))::integer as unpaids,
           (count(r.id) filter (where r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'WAIVED'))::integer as waiveds,
           coalesce(sum(r.payment_amount) filter (where r.status = 'ACTIVE' and r.payment_status = 'PAID'), 0)    as collected_amt,
           coalesce(sum(r.payment_amount) filter (where r.status = 'CANCELLED' and r.payment_status = 'PAID'), 0) as refunds_amt
      from public.matches m
      left join public.registrations r on r.match_id = m.id
     where m.id = any (p_match_ids)
     group by m.id, m.registration_fee
  ), exp as (
    select e.match_id as mid, sum(e.amount) as total
      from public.expenses e
     where e.match_id = any (p_match_ids)
     group by e.match_id
  )
  select a.mid, a.fee, a.mains, a.waits, a.paids, a.unpaids, a.waiveds,
         a.mains * a.fee,
         a.collected_amt,
         a.unpaids * a.fee,
         a.refunds_amt,
         coalesce(x.total, 0),
         a.collected_amt - coalesce(x.total, 0),
         a.collected_amt + a.unpaids * a.fee - coalesce(x.total, 0)
    from agg a
    left join exp x on x.mid = a.mid;
end $$;

revoke all on function public.admin_set_payment(uuid, text, numeric, text, text, text) from public, anon;
revoke all on function public.match_financials(uuid[]) from public, anon;
grant execute on function public.admin_set_payment(uuid, text, numeric, text, text, text) to authenticated;
grant execute on function public.match_financials(uuid[]) to authenticated;
