-- Clears ALL matches, registrations, payments, expenses and their activity history.
-- Use it to wipe test data before going live. IRREVERSIBLE: there is no undo.
--
-- KEPT:    users and their profiles/roles/approval status, the community row, payment instructions,
--          and the activity entries about people (approvals, blocks, role and password changes).
-- DELETED: matches, registrations (waiting lists, payments), expenses, share calculations,
--          and every activity entry about matches, registrations, payments, expenses and reminders.
--
-- How to use (Supabase SQL Editor):
--   1. Run the script as it is. It deletes nothing: it stops with a red "PREVIEW" message that lists what WOULD be deleted.
--   2. Change 'NO' to 'DELETE ALL MATCHES' on the line marked  <== EDIT HERE  and run it again.
-- All of it runs in one transaction: if anything fails, nothing is deleted.

do $$
declare
  v_confirm  text := 'NO';          -- <== EDIT HERE
  n_matches  bigint;
  n_regs     bigint;
  n_expenses bigint;
  n_settle   bigint;
  n_audit    bigint;
begin
  select count(*) into n_matches  from public.matches;
  select count(*) into n_regs     from public.registrations;
  select count(*) into n_expenses from public.expenses;
  select count(*) into n_settle   from public.match_settlements;
  select count(*) into n_audit    from public.audit_logs where entity_type <> 'profile';

  if v_confirm <> 'DELETE ALL MATCHES' then
    raise exception E'PREVIEW ONLY, NOTHING WAS DELETED.
Would delete: % matches, % registrations, % expenses, % share calculations, % activity entries.
To delete, set v_confirm to ''DELETE ALL MATCHES'' and run again.',
      n_matches, n_regs, n_expenses, n_settle, n_audit;
  end if;

  -- Children first (foreign keys). The expense delete trigger writes audit rows; they are removed below.
  delete from public.match_settlements;
  delete from public.expenses;
  delete from public.registrations;
  delete from public.matches;
  delete from public.audit_logs where entity_type <> 'profile';

end $$;

-- Shows what is left. After a real run every number is 0 except the people-related activity entries.
select (select count(*) from public.matches)                                   as matches_left,
       (select count(*) from public.registrations)                             as registrations_left,
       (select count(*) from public.expenses)                                  as expenses_left,
       (select count(*) from public.audit_logs where entity_type <> 'profile') as match_activity_left,
       (select count(*) from public.profiles)                                  as users_kept;

-- Afterwards (optional): announcement images of deleted matches stay in Storage. They are no longer shown anywhere.
-- Remove them in Supabase, Storage, match-images, or list them with:
--   select name from storage.objects where bucket_id = 'match-images';
