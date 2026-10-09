-- Phase 8: security hardening found during the RLS review. Safe to re-run.
--
-- matches.next_seq (total registrations ever made) and matches.created_by (the admin's user id) are
-- internal bookkeeping. They were readable by anyone who could read a match, including logged-out
-- visitors. Clients now get column-level SELECT on the public columns only.
--
-- NOTE: after this, `select *` on matches fails for clients. The app lists its columns explicitly
-- (src/lib/columns.ts). Run supabase/tests/security_review.sql afterwards to verify the whole setup.

revoke select on public.matches from anon, authenticated;
grant select (id, community_id, title, description, match_date, start_time, end_time, venue, max_players,
              registration_fee, registration_opens_at, registration_closes_at, rules, image_path, status,
              created_at, updated_at)
  on public.matches to anon, authenticated;
