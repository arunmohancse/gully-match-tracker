-- Phase 23: the payment-block grace period is measured against the match being registered for. Safe to re-run.
--
-- Before: a due was overdue once TODAY was payment_grace_days() (3) days past its match date. A player who owed for the
-- Oct 17 match could still register for an Oct 21 match on Oct 17, 18 or 19, because the due was "recent" at that moment.
-- Now: a due blocks registration for a match that takes place payment_grace_days() or more days AFTER the match owed for.
--   owes Oct 17, registering for Oct 21 (4 days later) -> blocked
--   owes Oct 17, registering for Oct 20 (3 days later) -> blocked
--   owes Oct 17, registering for Oct 18 or 19          -> allowed (consecutive-day matches; the admin needs time to verify payments)
-- Everything else is unchanged: which registrations count (ACTIVE, MAIN_LIST, UNPAID, amount above 0, match not DRAFT or
-- CANCELLED), and shared-cost dues still need their shares calculated before they count.
--
-- With no target match (p_match_id null) the reference date is today, which is the old behaviour.

-- The signatures change, so the 0015 versions are replaced, not overloaded.
drop function if exists public.my_payment_block();
drop function if exists public.overdue_dues(uuid);

-- Overdue dues of one user as of a reference date (internal; clients use my_payment_block()).
create or replace function public.overdue_dues(p_user_id uuid, p_ref_date date default null)
returns table (registration_id uuid, match_id uuid, title text, match_date date, amount numeric, overdue_since date)
language sql stable security definer set search_path = public as $$
  select x.rid, x.mid, x.title, x.mdate, x.amt, x.since
    from (
      select r.id as rid, m.id as mid, m.title, m.match_date as mdate,
             case when m.cost_model = 'SHARED_COST' then r.amount_due else m.registration_fee end as amt,
             m.match_date as since,
             coalesce(p_ref_date, (now() at time zone c.timezone)::date) as ref_date
        from public.registrations r
        join public.matches m on m.id = r.match_id
        join public.communities c on c.id = m.community_id
       where r.user_id = p_user_id
         and r.status = 'ACTIVE' and r.list_type = 'MAIN_LIST' and r.payment_status = 'UNPAID'
         and m.status not in ('DRAFT', 'CANCELLED')
    ) x
   where coalesce(x.amt, 0) > 0
     and x.ref_date >= x.since + public.payment_grace_days()
   order by x.mdate;
$$;

revoke all on function public.overdue_dues(uuid, date) from public, anon, authenticated;

-- The signed-in player's own overdue summary for registering for p_match_id, so the app can explain why Register is off.
create or replace function public.my_payment_block(p_match_id uuid default null)
returns table (overdue_count integer, overdue_total numeric, oldest_title text, oldest_date date, grace_days integer)
language sql stable security definer set search_path = public as $$
  select (count(*))::integer,
         coalesce(sum(d.amount), 0),
         (array_agg(d.title order by d.match_date))[1],
         min(d.match_date),
         public.payment_grace_days()
    from public.overdue_dues(auth.uid(), (select m.match_date from public.matches m where m.id = p_match_id)) d
   where auth.uid() is not null;
$$;

revoke all on function public.my_payment_block(uuid) from public, anon;
grant execute on function public.my_payment_block(uuid) to authenticated;

-- The rule itself: new registrations, and re-registering after a cancellation. Moves and payment changes are untouched.
create or replace function public.require_no_overdue_payment()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null
     and (tg_op = 'INSERT' or (old.status = 'CANCELLED' and new.status = 'ACTIVE'))
     and new.status = 'ACTIVE'
     and exists (
       select 1 from public.overdue_dues(new.user_id, (select m.match_date from public.matches m where m.id = new.match_id))
     ) then
    raise exception 'PAYMENT_DUE' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke all on function public.require_no_overdue_payment() from public, anon, authenticated;
