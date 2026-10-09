-- Phase 4: cancellation, automatic waiting-list promotion, admin moves, capacity rebalancing.
-- Safe to re-run. All functions run under the match-row lock (match first, then registrations).
--
-- Invariant (maintained here and in register_for_match): if anyone is waiting, the main list is full.

-- sync_match_status now only writes when the status really changes. This avoids needless
-- row updates and keeps the rebalance trigger below from re-firing.
create or replace function public.sync_match_status(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_main   integer;
  v_status text;
  v_max    integer;
  v_new    text;
begin
  select status, max_players into v_status, v_max from public.matches where id = p_match_id;
  select count(*) into v_main from public.registrations
   where match_id = p_match_id and status = 'ACTIVE' and list_type = 'MAIN_LIST';

  v_new := case
             when v_status = 'OPEN' and v_main >= v_max then 'FULL'
             when v_status = 'FULL' and v_main <  v_max then 'OPEN'
             else v_status end;

  if v_new is distinct from v_status then
    update public.matches set status = v_new where id = p_match_id;
  end if;
end $$;

-- Gives the listed registrations brand-new queue numbers, in the order given (all greater than any existing one).
create or replace function public.assign_new_seqs(p_match_id uuid, p_ids uuid[])
returns void language plpgsql security definer set search_path = public as $$
declare
  v_seq bigint;
  i integer;
begin
  select next_seq into v_seq from public.matches where id = p_match_id;
  for i in 1 .. coalesce(array_length(p_ids, 1), 0) loop
    update public.registrations set seq = v_seq where id = p_ids[i] and match_id = p_match_id;
    v_seq := v_seq + 1;
  end loop;
  update public.matches set next_seq = v_seq where id = p_match_id;
end $$;

-- Fills free main-list slots from the waiting list, earliest queue number first. Returns how many moved up.
create or replace function public.promote_waiting(p_match_id uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare
  v_max  integer;
  v_main integer;
  v_next uuid;
  v_user uuid;
  v_n    integer := 0;
begin
  select max_players into v_max from public.matches where id = p_match_id;
  loop
    select count(*) into v_main from public.registrations
     where match_id = p_match_id and status = 'ACTIVE' and list_type = 'MAIN_LIST';
    exit when v_main >= v_max;

    select id, user_id into v_next, v_user from public.registrations
     where match_id = p_match_id and status = 'ACTIVE' and list_type = 'WAITING_LIST'
     order by seq limit 1;
    exit when v_next is null;

    update public.registrations set list_type = 'MAIN_LIST' where id = v_next;
    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (auth.uid(), 'PLAYER_PROMOTED', 'registration', v_next,
            jsonb_build_object('match_id', p_match_id, 'user_id', v_user, 'automatic', true));
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke all on function public.sync_match_status(uuid) from public, anon, authenticated;
revoke all on function public.assign_new_seqs(uuid, uuid[]) from public, anon, authenticated;
revoke all on function public.promote_waiting(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- cancel_registration(registration_id): owner or admin; idempotent
-- ---------------------------------------------------------------------------
create or replace function public.cancel_registration(p_registration_id uuid)
returns table (registration_id uuid, status text, promoted_count integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid      uuid := auth.uid();
  v_match    uuid;
  v_admin    boolean;
  v_promoted integer := 0;
  m          public.matches;
  r          public.registrations;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select match_id into v_match from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Lock the match first, then re-read the registration under the lock.
  select * into m from public.matches where id = v_match for update;
  select * into r from public.registrations where id = p_registration_id for update;

  v_admin := public.is_admin();
  if r.user_id <> v_uid and not v_admin then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if r.status = 'ACTIVE' then
    -- Players may cancel only while registration is open; admins may always cancel.
    if not v_admin and not public.is_registration_open(m) then
      raise exception 'CANCELLATION_CLOSED' using errcode = 'P0001';
    end if;

    update public.registrations
       set status = 'CANCELLED', cancelled_at = now(), list_position = null
     where id = r.id;

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'REGISTRATION_CANCELLED', 'registration', r.id,
            jsonb_build_object('match_id', v_match, 'user_id', r.user_id, 'list_type', r.list_type,
                               'by_admin', v_admin and r.user_id <> v_uid,
                               'payment_status', r.payment_status));

    v_promoted := public.promote_waiting(v_match);
    perform public.recompute_positions(v_match);
    perform public.sync_match_status(v_match);

    select * into r from public.registrations where id = r.id;
  end if;

  return query select r.id, r.status, v_promoted;
end $$;

-- ---------------------------------------------------------------------------
-- admin_move_registration(registration_id, target_list, swap_with)
--   WAITING_LIST: player goes to the END of the waiting list; the first waiting player moves up.
--   MAIN_LIST:    needs a free slot, or p_swap_with = a main-list registration to swap out
--                 (that player goes to the FRONT of the waiting list).
-- ---------------------------------------------------------------------------
create or replace function public.admin_move_registration(
  p_registration_id uuid, p_target_list text, p_swap_with uuid default null)
returns table (registration_id uuid, list_type text, list_position integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_uid     uuid := auth.uid();
  v_match   uuid;
  v_main    integer;
  v_waiting integer;
  v_wait_ids uuid[];
  m         public.matches;
  r         public.registrations;
  s         public.registrations;
  v_from    text;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_target_list not in ('MAIN_LIST', 'WAITING_LIST') then
    raise exception 'INVALID_LIST' using errcode = 'P0001';
  end if;

  select match_id into v_match from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into m from public.matches where id = v_match for update;
  select * into r from public.registrations where id = p_registration_id for update;
  if r.status <> 'ACTIVE' then
    raise exception 'REGISTRATION_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  v_from := r.list_type;
  if v_from <> p_target_list then
    if p_target_list = 'WAITING_LIST' then
      select count(*) into v_waiting from public.registrations
       where match_id = v_match and status = 'ACTIVE' and list_type = 'WAITING_LIST';
      if v_waiting = 0 then
        raise exception 'NO_WAITING_PLAYERS' using errcode = 'P0001';
      end if;
      perform public.assign_new_seqs(v_match, array[r.id]);
      update public.registrations set list_type = 'WAITING_LIST' where id = r.id;
      perform public.promote_waiting(v_match);
    else
      select count(*) into v_main from public.registrations
       where match_id = v_match and status = 'ACTIVE' and list_type = 'MAIN_LIST';
      if v_main < m.max_players then
        perform public.assign_new_seqs(v_match, array[r.id]);
        update public.registrations set list_type = 'MAIN_LIST' where id = r.id;
      else
        if p_swap_with is null then
          raise exception 'MAIN_LIST_FULL' using errcode = 'P0001';
        end if;
        select * into s from public.registrations
         where id = p_swap_with and match_id = v_match and status = 'ACTIVE' and list_type = 'MAIN_LIST'
         for update;
        if not found then
          raise exception 'INVALID_SWAP' using errcode = 'P0001';
        end if;
        select array(select id from public.registrations
                      where match_id = v_match and status = 'ACTIVE' and list_type = 'WAITING_LIST' and id <> r.id
                      order by seq)
          into v_wait_ids;
        perform public.assign_new_seqs(v_match, array[r.id, s.id] || v_wait_ids);
        update public.registrations set list_type = 'MAIN_LIST'    where id = r.id;
        update public.registrations set list_type = 'WAITING_LIST' where id = s.id;
      end if;
    end if;

    perform public.recompute_positions(v_match);
    perform public.sync_match_status(v_match);

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (v_uid, 'PLAYER_MOVED', 'registration', r.id,
            jsonb_build_object('match_id', v_match, 'user_id', r.user_id, 'from', v_from, 'to', p_target_list,
                               'swapped_with', p_swap_with));
  end if;

  select * into r from public.registrations where id = r.id;
  return query select r.id, r.list_type, r.list_position;
end $$;

revoke all on function public.cancel_registration(uuid) from public, anon;
revoke all on function public.admin_move_registration(uuid, text, uuid) from public, anon;
grant execute on function public.cancel_registration(uuid) to authenticated;
grant execute on function public.admin_move_registration(uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Capacity changes
--   Lowering max_players below the current main-list count is rejected.
--   Raising it (or reopening) promotes waiting players and refreshes OPEN/FULL.
-- ---------------------------------------------------------------------------
create or replace function public.matches_check_capacity()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_main integer;
begin
  select count(*) into v_main from public.registrations
   where match_id = new.id and status = 'ACTIVE' and list_type = 'MAIN_LIST';
  if new.max_players < v_main then
    raise exception 'CAPACITY_BELOW_REGISTERED' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists matches_check_capacity on public.matches;
create trigger matches_check_capacity before update of max_players on public.matches
  for each row when (new.max_players < old.max_players)
  execute function public.matches_check_capacity();

create or replace function public.matches_rebalance()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.promote_waiting(new.id);
  perform public.recompute_positions(new.id);
  perform public.sync_match_status(new.id);
  return null;
end $$;

drop trigger if exists matches_rebalance on public.matches;
create trigger matches_rebalance after update of max_players, status on public.matches
  for each row when (old.max_players is distinct from new.max_players or old.status is distinct from new.status)
  execute function public.matches_rebalance();
