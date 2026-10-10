-- Exports all app data as JSON so you can keep a copy outside Supabase. READ-ONLY: it changes nothing.
-- The free plan has no automatic backups, so run this before launch and now and then (for example weekly, and always
-- before running clear_matches_and_expenses.sql).
--
-- How to use (Supabase SQL Editor):
--   1. Run the whole script. The result has one row per table: table_name, row_count, data (the rows as JSON).
--   2. Click "Download CSV" (or the export button) above the result and save the file somewhere private.
--      Name it with the date, for example gully-backup-2026-10-10.csv.
-- The file contains names, emails and phone numbers. Keep it private: not in the git repo, not in a shared drive.
-- Passwords are NOT included (they are not readable, and are not part of this export).
-- To restore a table later, ask for help: the JSON can be loaded back with jsonb_populate_recordset().

select 'auth_users' as table_name, count(*) as row_count,
       coalesce(jsonb_agg(jsonb_build_object('id', id, 'email', email, 'created_at', created_at, 'last_sign_in_at', last_sign_in_at, 'banned_until', banned_until) order by created_at), '[]'::jsonb) as data
  from auth.users
union all select 'communities',       count(*), coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.communities t
union all select 'profiles',          count(*), coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.profiles t
union all select 'matches',           count(*), coalesce(jsonb_agg(to_jsonb(t) order by t.match_date), '[]'::jsonb) from public.matches t
union all select 'registrations',     count(*), coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.registrations t
union all select 'expenses',          count(*), coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.expenses t
union all select 'match_settlements', count(*), coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb) from public.match_settlements t
union all select 'audit_logs',        count(*), coalesce(jsonb_agg(to_jsonb(t) order by t.created_at), '[]'::jsonb) from public.audit_logs t;
