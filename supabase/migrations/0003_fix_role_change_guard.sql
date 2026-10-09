-- Fix: allow role changes made directly in the database (SQL Editor / service role),
-- where there is no app user (auth.uid() is null). Logged-in non-admins are still blocked.
-- Client roles also have no UPDATE grant on profiles.role (see 0001), so this is a second layer.
create or replace function public.prevent_role_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return new;
end $$;
