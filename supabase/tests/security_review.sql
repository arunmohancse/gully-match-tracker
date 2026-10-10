-- Security review checks. Requires migrations 0001-0016. READ-ONLY: it changes nothing.
-- Paste into the Supabase SQL Editor and Run. Success: the result shows "SECURITY REVIEW PASSED".
-- Any problem raises an error that lists exactly what is wrong. Re-run it after every new migration.

do $$
declare
  v_bad text;
  v_expected_anon text[] := array['get_match_counts', 'is_admin', 'reset_password_with_phone'];
  v_expected_auth text[] := array['admin_list_players', 'admin_move_registration', 'admin_player_counts', 'admin_set_password_reset', 'admin_set_payment', 'admin_set_temp_password', 'admin_set_user_status',
                                  'cancel_registration', 'complete_own_password_reset', 'finalize_match_shares', 'get_match_counts',
                                  'get_match_roster', 'is_admin', 'log_reminder_opened', 'match_financials', 'my_payment_block', 'register_for_match',
                                  'reset_password_with_phone', 'set_user_role'];
begin
  -- 1. Every table in public has Row Level Security enabled ------------------------------------------------
  select string_agg(c.relname, ', ') into v_bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity;
  if v_bad is not null then raise exception 'FAIL [RLS disabled on]: %', v_bad; end if;

  -- 2. Logged-out visitors (anon) can only read communities and matches, never write -------------------------
  select string_agg(c.relname || ':' || p.priv, ', ') into v_bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where n.nspname = 'public' and c.relkind = 'r'
     and has_table_privilege('anon', c.oid, p.priv)
     and not (p.priv = 'SELECT' and c.relname = 'communities');
  if v_bad is not null then raise exception 'FAIL [anon has unexpected table privileges]: %', v_bad; end if;
  if has_table_privilege('anon', 'public.matches', 'SELECT') then
    raise exception 'FAIL [anon has table-wide SELECT on matches; it should be column-level only]';
  end if;
  if has_any_column_privilege('anon', 'public.matches', 'INSERT, UPDATE') then
    raise exception 'FAIL [anon can write matches columns]';
  end if;

  -- 3. Logged-in users have no table-wide write access anywhere; deletes only where intended ----------------------
  select string_agg(c.relname || ':' || p.priv, ', ') into v_bad
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
   cross join (values ('INSERT'), ('UPDATE'), ('DELETE'), ('TRUNCATE'), ('REFERENCES'), ('TRIGGER')) as p(priv)
   where n.nspname = 'public' and c.relkind = 'r'
     and has_table_privilege('authenticated', c.oid, p.priv)
     and not (p.priv = 'DELETE' and c.relname = 'expenses');
  if v_bad is not null then raise exception 'FAIL [authenticated has unexpected table-wide privileges]: %', v_bad; end if;

  -- 4. Column-level rules ------------------------------------------------------------------------------------
  if has_column_privilege('authenticated', 'public.profiles', 'role', 'UPDATE') or has_column_privilege('authenticated', 'public.profiles', 'id', 'UPDATE') then
    raise exception 'FAIL [users can update profiles.role or profiles.id]';
  end if;
  if has_column_privilege('authenticated', 'public.profiles', 'status', 'UPDATE') or has_column_privilege('authenticated', 'public.profiles', 'password_reset_until', 'UPDATE') then
    raise exception 'FAIL [users can update profiles.status or profiles.password_reset_until]';
  end if;
  if not (has_column_privilege('authenticated', 'public.profiles', 'full_name', 'UPDATE')
          and has_column_privilege('authenticated', 'public.profiles', 'phone', 'UPDATE')) then
    raise exception 'FAIL [users cannot update their own name / phone]';
  end if;
  if has_any_column_privilege('authenticated', 'public.registrations', 'INSERT, UPDATE') then
    raise exception 'FAIL [users can write registrations directly; all writes must go through functions]';
  end if;
  if has_any_column_privilege('authenticated', 'public.audit_logs', 'INSERT, UPDATE') then
    raise exception 'FAIL [users can write the audit log]';
  end if;
  select string_agg(a.attname, ', ') into v_bad
    from pg_attribute a
   where a.attrelid = 'public.matches'::regclass and a.attname in ('next_seq', 'created_by')
     and (has_column_privilege('anon', a.attrelid, a.attnum, 'SELECT')
          or has_column_privilege('authenticated', a.attrelid, a.attnum, 'SELECT')
          or has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT')
          or has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE'));
  if v_bad is not null then raise exception 'FAIL [internal matches columns are exposed]: %', v_bad; end if;
  if has_column_privilege('authenticated', 'public.expenses', 'created_by', 'UPDATE')
     or has_column_privilege('authenticated', 'public.expenses', 'match_id', 'UPDATE') then
    raise exception 'FAIL [expenses.created_by / match_id are updatable]';
  end if;

  if has_column_privilege('anon', 'public.communities', 'payment_instructions', 'SELECT') then
    raise exception 'FAIL [logged-out visitors can read the payment instructions]';
  end if;
  if not has_column_privilege('authenticated', 'public.communities', 'payment_instructions', 'SELECT') then
    raise exception 'FAIL [logged-in users cannot read the payment instructions]';
  end if;
  if has_column_privilege('anon', 'public.communities', 'upi_id', 'SELECT') or has_column_privilege('anon', 'public.communities', 'upi_payee_name', 'SELECT') then
    raise exception 'FAIL [logged-out visitors can read the UPI settings]';
  end if;
  if not (has_column_privilege('authenticated', 'public.communities', 'upi_id', 'SELECT')
          and has_column_privilege('authenticated', 'public.communities', 'upi_id', 'UPDATE')) then
    raise exception 'FAIL [logged-in users cannot read the UPI id, or it cannot be updated]';
  end if;
  if has_column_privilege('authenticated', 'public.communities', 'name', 'UPDATE')
     or has_column_privilege('authenticated', 'public.communities', 'slug', 'UPDATE')
     or has_column_privilege('authenticated', 'public.communities', 'timezone', 'UPDATE') then
    raise exception 'FAIL [users can update community name / slug / timezone]';
  end if;
  if has_any_column_privilege('anon', 'public.match_settlements', 'SELECT, INSERT, UPDATE')
     or has_any_column_privilege('authenticated', 'public.match_settlements', 'INSERT, UPDATE') then
    raise exception 'FAIL [match_settlements is exposed or writable by clients]';
  end if;

  -- 5. Callable functions: exactly the intended list (ignoring trigger functions and extension functions) ---------
  select string_agg(p.proname, ', ' order by p.proname) into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('anon', p.oid, 'EXECUTE')
     and p.proname <> all (v_expected_anon);
  if v_bad is not null then raise exception 'FAIL [anon can execute]: %', v_bad; end if;

  select string_agg(p.proname, ', ' order by p.proname) into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.prorettype not in ('trigger'::regtype, 'event_trigger'::regtype)
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and has_function_privilege('authenticated', p.oid, 'EXECUTE')
     and p.proname <> all (v_expected_auth);
  if v_bad is not null then raise exception 'FAIL [authenticated can execute unexpected functions]: %', v_bad; end if;

  select string_agg(x, ', ') into v_bad from unnest(v_expected_auth) x
   where not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                      where n.nspname = 'public' and p.proname = x);
  if v_bad is not null then raise exception 'FAIL [expected functions are missing]: %', v_bad; end if;

  -- 5b. Trigger functions are not callable through the API (migration 0016) --------------------------------------------
  select string_agg(p.proname, ', ' order by p.proname) into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prorettype in ('trigger'::regtype, 'event_trigger'::regtype)
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and (has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE'));
  if v_bad is not null then raise exception 'FAIL [trigger functions callable by clients, run 0016]: %', v_bad; end if;

  -- 6. Every SECURITY DEFINER function pins its search_path (prevents search_path hijacking) ------------------------
  select string_agg(p.proname, ', ') into v_bad
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and p.prorettype <> 'event_trigger'::regtype
     and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
     and not coalesce(p.proconfig::text ilike '%search_path%', false);
  if v_bad is not null then raise exception 'FAIL [SECURITY DEFINER without a fixed search_path]: %', v_bad; end if;

  -- 7. Storage bucket: public read, size and type limits ----------------------------------------------------------------
  if not exists (select 1 from storage.buckets where id = 'match-images' and public and file_size_limit <= 5242880
                  and allowed_mime_types is not null) then
    raise exception 'FAIL [match-images bucket is missing, or lacks size / type limits]';
  end if;
  select string_agg(policyname, ', ') into v_bad from pg_policies
   where schemaname = 'storage' and tablename = 'objects' and policyname like 'match_images%'
     and cmd <> 'SELECT' and qual is null and with_check is null;
  if v_bad is not null then raise exception 'FAIL [storage write policies without a condition]: %', v_bad; end if;

  -- 8. The role-change guard and signup trigger exist ----------------------------------------------------------------------
  if not exists (select 1 from pg_trigger where tgname = 'profiles_prevent_role_change' and not tgisinternal) then
    raise exception 'FAIL [profiles_prevent_role_change trigger missing]';
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'on_auth_user_created' and not tgisinternal) then
    raise exception 'FAIL [on_auth_user_created trigger missing]';
  end if;
end $$;

select 'SECURITY REVIEW PASSED' as result;
