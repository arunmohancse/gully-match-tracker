-- Phase 16: clean up Supabase Security Advisor warnings. No behaviour change. Safe to re-run.
--
-- 1. Trigger functions are never meant to be called directly. Postgres refuses to run them outside a trigger anyway,
--    but they were still listed as callable through the API because functions are executable by everyone by default.
--    Triggers keep firing: Postgres checks EXECUTE on a trigger function only when the trigger is created, not when it fires.
-- 2. Functions without a fixed search_path get one (the advisor's "function_search_path_mutable" warning).
--
-- Not changed on purpose: the admin_*/register/cancel/... functions that signed-in users can call. Those ARE the app's API;
-- each checks who is calling inside the function (security_review.sql lists exactly which ones are allowed).

do $$
declare
  f record;
begin
  -- 1. Nobody calls trigger functions through the API.
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
       and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  loop
    execute format('revoke execute on function %s from public, anon, authenticated', f.sig);
  end loop;

  -- 2. Pin the search_path of the plain functions the advisor flagged (they only use built-ins and public tables).
  for f in
    select p.oid::regprocedure as sig
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.proname in ('set_updated_at', 'matches_guard_status', 'registrations_clear_amount_due', 'payment_grace_days')
  loop
    execute format('alter function %s set search_path = public', f.sig);
  end loop;
end $$;
