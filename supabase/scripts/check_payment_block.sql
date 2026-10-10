-- Explains why a player is, or is not, blocked from registering because of overdue payments. READ-ONLY.
-- Set the player's email on the line marked <== EDIT HERE, then run it in the Supabase SQL Editor. It shows 3 result tabs/rows:
--   1. is migration 0015 installed?
--   2. every unpaid registration of the player and whether it counts as overdue, with the reason
--   3. what the database says is overdue (empty = the player is not blocked)

with p as (select 'player@example.com'::text as email)   -- <== EDIT HERE
select 'migration 0015 installed' as check,
       (select count(*) from pg_proc where proname in ('overdue_dues', 'my_payment_block', 'payment_grace_days', 'require_no_overdue_payment')) || ' of 4 functions found' as result
union all
select 'trigger on registrations',
       coalesce((select 'yes' from pg_trigger where tgname = 'registrations_require_no_overdue' and not tgisinternal), 'MISSING - run 0015');

with p as (select 'player@example.com'::text as email)   -- <== EDIT HERE
select m.title,
       m.match_date,
       m.status                                   as match_status,
       m.cost_model,
       r.list_type,
       r.status                                   as reg_status,
       r.payment_status,
       m.registration_fee,
       r.amount_due,
       s.calculated_at::date                      as shares_calculated_on,
       (now() at time zone c.timezone)::date - m.match_date as days_since_match,
       case
         when r.status <> 'ACTIVE'                             then 'no: registration cancelled'
         when r.list_type <> 'MAIN_LIST'                       then 'no: waiting list'
         when r.payment_status <> 'UNPAID'                     then 'no: ' || lower(r.payment_status)
         when m.status in ('DRAFT', 'CANCELLED')               then 'no: match ' || lower(m.status)
         when m.cost_model = 'SHARED_COST' and r.amount_due is null then 'no: shares not calculated yet (calculate them on the match page)'
         when coalesce(case when m.cost_model = 'SHARED_COST' then r.amount_due else m.registration_fee end, 0) <= 0 then 'no: nothing to pay'
         when (now() at time zone c.timezone)::date < m.match_date + 3
                                                                then 'no: still inside the 3 day grace period'
         else 'YES: overdue'
       end as counts_as_overdue
  from p
  join auth.users u on lower(u.email) = lower(p.email)
  join public.registrations r on r.user_id = u.id
  join public.matches m on m.id = r.match_id
  join public.communities c on c.id = m.community_id
  left join public.match_settlements s on s.match_id = m.id
 order by m.match_date;

with p as (select 'player@example.com'::text as email)   -- <== EDIT HERE
select d.*
  from p
  join auth.users u on lower(u.email) = lower(p.email)
  cross join lateral public.overdue_dues(u.id) d;
