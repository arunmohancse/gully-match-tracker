-- Phase 21: UPCOMING match status ("published, registration not open yet"). Safe to re-run.
--
-- DRAFT   = admins only.
-- UPCOMING = visible to every player, registration is off until an admin opens it (-> OPEN).
-- Players already see every match that is not a DRAFT (matches_select policy, 0002), so no policy changes.
-- is_registration_open() and sync_match_status() only treat OPEN / FULL as live, so UPCOMING is already
-- "not open" for them. Only register_for_match needs a change: it should answer REGISTRATION_NOT_OPEN
-- (instead of REGISTRATION_CLOSED) for an UPCOMING match.

-- 1. Allow the new status. The original check was created inline in 0002, so find it by what it checks.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'public.matches'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%DRAFT%'
  loop
    execute format('alter table public.matches drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.matches add constraint matches_status_check
  check (status in ('DRAFT','UPCOMING','OPEN','FULL','CLOSED','COMPLETED','CANCELLED'));

-- 2. register_for_match: same as 0004 apart from the UPCOMING branch.
create or replace function public.register_for_match(p_match_id uuid)
returns table (
  registration_id    uuid,
  match_id           uuid,
  list_type          text,
  list_position      integer,
  payment_status     text,
  payment_amount     numeric,
  registered_at      timestamptz,
  already_registered boolean
)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  m         public.matches;
  r         public.registrations;
  v_main    integer;
  v_waiting integer;
  v_list    text;
  v_seq     bigint;
  v_already boolean := false;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  -- 1. Lock the match row: serializes all registrations for this match.
  select * into m from public.matches where id = p_match_id and status <> 'DRAFT' for update;
  if not found then
    raise exception 'MATCH_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into r from public.registrations where match_id = p_match_id and user_id = v_uid for update;

  if found and r.status = 'ACTIVE' then
    -- Idempotent: a retry (timeout, double click, refresh) returns the existing registration.
    v_already := true;
  else
    -- 2. Is registration allowed right now?
    if m.status = 'CANCELLED' then
      raise exception 'MATCH_CANCELLED' using errcode = 'P0001';
    elsif m.status = 'UPCOMING' then
      raise exception 'REGISTRATION_NOT_OPEN' using errcode = 'P0001';
    elsif m.status not in ('OPEN','FULL') then
      raise exception 'REGISTRATION_CLOSED' using errcode = 'P0001';
    elsif m.registration_opens_at is not null and now() < m.registration_opens_at then
      raise exception 'REGISTRATION_NOT_OPEN' using errcode = 'P0001';
    elsif not public.is_registration_open(m) then
      raise exception 'REGISTRATION_CLOSED' using errcode = 'P0001';
    end if;

    -- 3. Decide the list. Main only if there is room AND nobody is waiting (keeps queue order fair).
    select count(*) filter (where list_type = 'MAIN_LIST'),
           count(*) filter (where list_type = 'WAITING_LIST')
      into v_main, v_waiting
      from public.registrations
     where match_id = p_match_id and status = 'ACTIVE';

    v_list := case when v_main < m.max_players and v_waiting = 0 then 'MAIN_LIST' else 'WAITING_LIST' end;

    v_seq := m.next_seq;
    update public.matches set next_seq = next_seq + 1 where id = m.id;

    if r.id is null then
      insert into public.registrations (match_id, user_id, list_type, seq)
      values (p_match_id, v_uid, v_list, v_seq)
      returning * into r;
    else
      -- Re-registration after cancelling: same row, back of the queue.
      -- A REFUNDED payment is reset; PAID / WAIVED / UNPAID are kept.
      update public.registrations
         set status = 'ACTIVE', list_type = v_list, seq = v_seq, list_position = null,
             registered_at = now(), cancelled_at = null,
             payment_amount    = case when payment_status = 'REFUNDED' then null else payment_amount end,
             payment_reference = case when payment_status = 'REFUNDED' then null else payment_reference end,
             payment_method    = case when payment_status = 'REFUNDED' then null else payment_method end,
             payment_notes     = case when payment_status = 'REFUNDED' then null else payment_notes end,
             paid_at           = case when payment_status = 'REFUNDED' then null else paid_at end,
             payment_status    = case when payment_status = 'REFUNDED' then 'UNPAID' else payment_status end
       where id = r.id
       returning * into r;
    end if;

    perform public.recompute_positions(p_match_id);
    perform public.sync_match_status(p_match_id);

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'REGISTRATION_CREATED', 'registration', r.id,
            jsonb_build_object('match_id', p_match_id, 'user_id', v_uid, 'list_type', v_list));

    select * into r from public.registrations where id = r.id;
  end if;

  return query
    select r.id, r.match_id, r.list_type, r.list_position, r.payment_status, r.payment_amount, r.registered_at, v_already;
end $$;

revoke all on function public.register_for_match(uuid) from public, anon;
grant execute on function public.register_for_match(uuid) to authenticated;
