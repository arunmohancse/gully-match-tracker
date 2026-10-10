-- Deletes ONE user account (login + profile) by email, e.g. a duplicate created with a mistyped email.
-- IRREVERSIBLE. Run in the Supabase SQL Editor.
--
-- How to use:
--   1. Set v_email to the WRONG email. Run it as it is: it deletes nothing and stops with a "PREVIEW" message.
--   2. Check the message shows the account you mean to remove, then set v_confirm to 'DELETE USER' and run again.
--
-- The script refuses to delete an account that still has registrations (they would be orphaned):
-- it tells you, and you decide what to do (usually nothing: such an account is a real player).
-- Matches, expenses and settlements created by the user are kept (created_by becomes empty); activity entries keep an empty actor.

do $$
declare
  v_email   text := 'saeivishnu@gmail.com';   -- <== EDIT HERE: the WRONG email
  v_confirm text := 'NO';                      -- <== EDIT HERE: 'DELETE USER' to really delete
  v_id      uuid;
  v_name    text;
  v_role    text;
  n_regs    bigint;
begin
  select u.id into v_id from auth.users u where lower(u.email) = lower(v_email);
  if v_id is null then
    raise exception 'No user found with email %', v_email;
  end if;

  select p.full_name, p.role::text into v_name, v_role from public.profiles p where p.id = v_id;
  select count(*) into n_regs from public.registrations where user_id = v_id;

  if n_regs > 0 then
    raise exception 'NOT DELETED: % (%) has % registration(s). Remove or reassign them first.', v_email, v_name, n_regs;
  end if;

  if v_confirm <> 'DELETE USER' then
    raise exception E'PREVIEW ONLY, NOTHING WAS DELETED.\nWould delete: % | name: % | role: % | registrations: 0.\nTo delete, set v_confirm to ''DELETE USER'' and run again.',
      v_email, v_name, v_role;
  end if;

  delete from auth.users where id = v_id;   -- profile row goes with it (on delete cascade)
end $$;

-- Both spellings should now show only the correct one.
select u.email, p.full_name, p.role, p.status
from auth.users u left join public.profiles p on p.id = u.id
where u.email ilike '%vishnu%';
