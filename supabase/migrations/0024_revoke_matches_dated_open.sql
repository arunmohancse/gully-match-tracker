-- Phase 24: trigger function matches_dated_open (migration 0022) must not be callable through the API, like every other
-- trigger function (see 0016). Safe to re-run. Triggers keep working: they do not need the caller to hold EXECUTE.
revoke all on function public.matches_dated_open() from public, anon, authenticated;
