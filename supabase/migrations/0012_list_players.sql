-- Phase 12: paged, server-side player list for Admin > Players. Safe to re-run.
--
-- The page used to download every profile and every registration to count them in the browser, which stops being
-- correct past 1,000 rows (the API's row limit). These functions search, filter, count and page inside the database.
-- Both are admin only.

create or replace function public.admin_list_players(
  p_query  text    default null,
  p_status text    default null,
  p_limit  integer default 50,
  p_offset integer default 0)
returns table (
  id                   uuid,
  full_name            text,
  phone                text,
  role                 text,
  status               text,
  password_reset_until timestamptz,
  created_at           timestamptz,
  registration_count   bigint,
  total_count          bigint)
language plpgsql stable security definer set search_path = public as $$
#variable_conflict use_column
declare
  v_limit   integer := least(greatest(coalesce(p_limit, 50), 1), 200);
  v_offset  integer := greatest(coalesce(p_offset, 0), 0);
  v_pattern text    := null;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  if p_status is not null and p_status not in ('PENDING', 'ACTIVE', 'BLOCKED') then
    raise exception 'INVALID_STATUS' using errcode = 'P0001';
  end if;
  if nullif(btrim(coalesce(p_query, '')), '') is not null then
    -- Escape LIKE wildcards so a search for "50%" or "a_b" is matched literally.
    v_pattern := '%' || replace(replace(replace(btrim(p_query), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  return query
  with filtered as (
    select p.id, p.full_name, p.phone, p.role, p.status, p.password_reset_until, p.created_at
      from public.profiles p
     where (p_status is null or p.status = p_status)
       and (v_pattern is null
            or p.full_name ilike v_pattern escape '\'
            or coalesce(p.phone, '') ilike v_pattern escape '\')
  ), total as (
    select count(*) as c from filtered
  )
  select f.id, f.full_name, f.phone, f.role, f.status, f.password_reset_until, f.created_at,
         (select count(*) from public.registrations r where r.user_id = f.id),
         t.c
    from filtered f cross join total t
   order by lower(f.full_name), f.id
   limit v_limit offset v_offset;
end $$;

-- Totals for the filter buttons: everyone, waiting for approval, blocked.
create or replace function public.admin_player_counts()
returns table (total_count bigint, pending_count bigint, blocked_count bigint)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;
  return query
  select count(*), count(*) filter (where status = 'PENDING'), count(*) filter (where status = 'BLOCKED')
    from public.profiles;
end $$;

revoke all on function public.admin_list_players(text, text, integer, integer) from public, anon;
revoke all on function public.admin_player_counts() from public, anon;
grant execute on function public.admin_list_players(text, text, integer, integer) to authenticated;
grant execute on function public.admin_player_counts() to authenticated;
