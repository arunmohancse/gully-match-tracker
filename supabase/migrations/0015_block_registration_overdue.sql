-- Phase 15: a player with an overdue payment cannot register for a new match. Safe to re-run.
--
-- A due is OVERDUE once payment_grace_days() (3) days have passed since the MATCH DATE, so players who paid recently have time
-- to be verified and marked paid by an admin (matches on consecutive days, for example).
-- For shared-cost matches the amount must be known (shares calculated) for it to count, but the clock still runs from the match date.
-- Counted: ACTIVE main-list registrations that are UNPAID with an amount above 0, for matches that are not DRAFT or CANCELLED.
-- Waived, paid, refunded, waiting-list and cancelled registrations never count. An admin marking the payment (or waiving it) lifts the block.
--
-- Enforced by a trigger on registrations (like require_active_account), so every way of registering is covered.
-- Players only ever read their own result, through my_payment_block().

-- One place to change the grace period.
create or replace function public.payment_grace_days()
returns integer language sql immutable set search_path = public as $$ select 3 $$;

-- Overdue dues of one user (internal; clients use my_payment_block()).
create or replace function public.overdue_dues(p_user_id uuid)
returns table (registration_id uuid, match_id uuid, title text, match_date date, amount numeric, overdue_since date)
language sql stable security definer set search_path = public as $$
  select x.rid, x.mid, x.title, x.mdate, x.amt, x.since
    from (
      select r.id as rid, m.id as mid, m.title, m.match_date as mdate,
             case when m.cost_model = 'SHARED_COST' then r.amount_due else m.registration_fee end as amt,
             m.match_date as since,
             (now() at time zone c.timezone)::date as today
        from public.registrations r
        join public.matches m on m.id = r.match_id
        join public.communities c on c.id = m.community_id
       where r.user_id = p_user_id
         and r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'UNPAID'
         and m.status not in ('DRAFT', 'CANCELLED')
    ) x
   where coalesce(x.amt, 0) > 0
     and x.today >= x.since + public.payment_grace_days()
   order by x.mdate;
$$;

revoke all on function public.payment_grace_days() from public, anon, authenticated;
revoke all on function public.overdue_dues(uuid) from public, anon, authenticated;

-- The signed-in player's own overdue summary, so the app can explain why Register is off.
create or replace function public.my_payment_block()
returns table (overdue_count integer, overdue_total numeric, oldest_title text, oldest_date date, grace_days integer)
language sql stable security definer set search_path = public as $$
  select (count(*))::integer,
         coalesce(sum(d.amount), 0),
         (array_agg(d.title order by d.match_date))[1],
         min(d.match_date),
         public.payment_grace_days()
    from public.overdue_dues(auth.uid()) d
   where auth.uid() is not null;
$$;

revoke all on function public.my_payment_block() from public, anon;
grant execute on function public.my_payment_block() to authenticated;

-- The rule itself: new registrations, and re-registering after a cancellation. Moves and payment changes are untouched.
create or replace function public.require_no_overdue_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' or (old.status = 'CANCELLED' and new.status = 'ACTIVE'))
     and new.status = 'ACTIVE'
     and exists (select 1 from public.overdue_dues(new.user_id)) then
    raise exception 'PAYMENT_DUE' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke all on function public.require_no_overdue_payment() from public, anon, authenticated;

drop trigger if exists registrations_require_no_overdue on public.registrations;
create trigger registrations_require_no_overdue before insert or update on public.registrations
  for each row execute function public.require_no_overdue_payment();
