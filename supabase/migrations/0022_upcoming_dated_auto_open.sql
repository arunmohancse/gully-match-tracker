-- Phase 22: a published (UPCOMING) match with a future registration opening day opens by itself on that day. Safe to re-run.
--
-- The database already holds registration back until registration_opens_at for an OPEN match, and players see
-- "Opens <day>". UPCOMING has no such date logic (it only opens by hand), so a match published first and given a
-- date afterwards just said "Registration not open yet". Rather than teach every place about UPCOMING + date, an
-- UPCOMING match that gets a future opening day becomes OPEN, the same state a dated draft is published into.
-- A date that has already passed is left alone, so an admin can still hold a match back by hand.

create or replace function public.matches_dated_open()
returns trigger language plpgsql as $$
begin
  if new.status = 'UPCOMING' and new.registration_opens_at is not null and new.registration_opens_at > now() then
    new.status := 'OPEN';
  end if;
  return new;
end $$;

drop trigger if exists matches_dated_open on public.matches;
create trigger matches_dated_open before insert or update on public.matches
  for each row execute function public.matches_dated_open();

-- Existing published matches that already have a future opening day.
update public.matches set status = 'OPEN'
 where status = 'UPCOMING' and registration_opens_at is not null and registration_opens_at > now();
