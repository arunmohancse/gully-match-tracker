-- Phase 3: registrations, atomic register_for_match(), roster + counts RPCs.
-- Safe to re-run. Cancellation / promotion arrive in Phase 4 (0005).
--
-- Concurrency model: every mutating function first locks the match row
-- (SELECT ... FOR UPDATE), so registrations for one match are fully serialized.
-- Lock order is always: match row first, then registration rows.
--
-- Invariant maintained by all functions: if anyone is on the waiting list, the main list is full.
--
-- Note: 0003 fixed prevent_role_change() so the SQL Editor can promote the first admin.

create table if not exists public.registrations (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references public.matches(id),
  user_id           uuid not null references public.profiles(id),
  status            text not null default 'ACTIVE' check (status in ('ACTIVE','CANCELLED')),
  list_type         text not null check (list_type in ('MAIN_LIST','WAITING_LIST')),
  list_position     integer check (list_position is null or list_position > 0),
  seq               bigint not null,   -- deterministic queue order within a match (from matches.next_seq)
  payment_status    text not null default 'UNPAID' check (payment_status in ('UNPAID','PAID','REFUNDED','WAIVED')),
  payment_amount    numeric(10,2) check (payment_amount is null or payment_amount >= 0),
  payment_reference text,
  payment_method    text,
  payment_notes     text,
  paid_at           timestamptz,
  registered_at     timestamptz not null default now(),
  cancelled_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint registrations_match_user_key unique (match_id, user_id),
  constraint registrations_match_seq_key  unique (match_id, seq)
);
create index if not exists registrations_queue_idx on public.registrations (match_id, status, list_type, seq);
create index if not exists registrations_user_idx  on public.registrations (user_id);

drop trigger if exists registrations_set_updated_at on public.registrations;
create trigger registrations_set_updated_at before update on public.registrations
  for each row execute function public.set_updated_at();

-- RLS: users see only their own rows, admins see all. No client writes at all.
alter table public.registrations enable row level security;
drop policy if exists registrations_select on public.registrations;
create policy registrations_select on public.registrations for select
  using (user_id = auth.uid() or public.is_admin());
revoke all on public.registrations from anon, authenticated;
grant select on public.registrations to authenticated;

-- ---------------------------------------------------------------------------
-- Internal helpers (not callable by clients)
-- ---------------------------------------------------------------------------

-- True when new registrations are currently allowed (server time, community timezone).
create or replace function public.is_registration_open(m public.matches)
returns boolean language sql stable set search_path = public as $$
  select m.status in ('OPEN','FULL')
    and (m.registration_opens_at  is null or now() >= m.registration_opens_at)
    and (m.registration_closes_at is null or now() <  m.registration_closes_at)
    and now() < ((m.match_date + m.start_time)
                  at time zone (select c.timezone from public.communities c where c.id = m.community_id));
$$;

-- Rewrites list_position for ACTIVE rows (1..n per list, ordered by seq); clears it for CANCELLED rows.
create or replace function public.recompute_positions(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.registrations r
     set list_position = x.pos
    from (select id, row_number() over (partition by list_type order by seq) as pos
            from public.registrations
           where match_id = p_match_id and status = 'ACTIVE') x
   where r.id = x.id and r.list_position is distinct from x.pos;

  update public.registrations
     set list_position = null
   where match_id = p_match_id and status = 'CANCELLED' and list_position is not null;
end $$;

-- Automatic OPEN <-> FULL based on main-list occupancy. Never touches other statuses.
create or replace function public.sync_match_status(p_match_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_main integer;
begin
  select count(*) into v_main from public.registrations
   where match_id = p_match_id and status = 'ACTIVE' and list_type = 'MAIN_LIST';

  update public.matches m
     set status = case
           when m.status = 'OPEN' and v_main >= m.max_players then 'FULL'
           when m.status = 'FULL' and v_main <  m.max_players then 'OPEN'
           else m.status end
   where m.id = p_match_id;
end $$;

revoke all on function public.is_registration_open(public.matches) from public, anon, authenticated;
revoke all on function public.recompute_positions(uuid) from public, anon, authenticated;
revoke all on function public.sync_match_status(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- register_for_match(match_id): atomic and idempotent
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- Read RPCs: names only, never phones / payment details of other players
-- ---------------------------------------------------------------------------
create or replace function public.get_match_roster(p_match_id uuid)
returns table (display_name text, list_type text, list_position integer, is_me boolean)
language sql stable security definer set search_path = public as $$
  select p.full_name, r.list_type, r.list_position, (r.user_id = auth.uid())
    from public.registrations r
    join public.profiles p on p.id = r.user_id
    join public.matches  m on m.id = r.match_id
   where auth.uid() is not null
     and r.match_id = p_match_id
     and r.status = 'ACTIVE'
     and (m.status <> 'DRAFT' or public.is_admin())
   order by case r.list_type when 'MAIN_LIST' then 0 else 1 end, r.list_position;
$$;

-- Counts for many matches at once (also usable by logged-out visitors on the share page).
create or replace function public.get_match_counts(p_match_ids uuid[])
returns table (match_id uuid, main_count integer, waiting_count integer)
language sql stable security definer set search_path = public as $$
  select m.id,
         (count(r.id) filter (where r.list_type = 'MAIN_LIST'))::integer,
         (count(r.id) filter (where r.list_type = 'WAITING_LIST'))::integer
    from public.matches m
    left join public.registrations r on r.match_id = m.id and r.status = 'ACTIVE'
   where m.id = any (p_match_ids)
     and (m.status <> 'DRAFT' or public.is_admin())
   group by m.id;
$$;

revoke all on function public.register_for_match(uuid) from public, anon;
revoke all on function public.get_match_roster(uuid) from public, anon;
revoke all on function public.get_match_counts(uuid[]) from public;
grant execute on function public.register_for_match(uuid) to authenticated;
grant execute on function public.get_match_roster(uuid) to authenticated;
grant execute on function public.get_match_counts(uuid[]) to anon, authenticated;
