-- Phase 7: record WhatsApp reminders that an admin opened (Click-to-Chat cannot confirm they were sent).
-- Safe to re-run.

create index if not exists audit_logs_action_idx on public.audit_logs (action, entity_id, created_at desc);

create or replace function public.log_reminder_opened(p_registration_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  r public.registrations;
begin
  if auth.uid() is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if not public.is_admin() then
    raise exception 'NOT_ALLOWED' using errcode = 'P0001';
  end if;

  select * into r from public.registrations where id = p_registration_id;
  if not found then
    raise exception 'REGISTRATION_NOT_FOUND' using errcode = 'P0001';
  end if;
  if r.status <> 'ACTIVE' then
    raise exception 'REGISTRATION_NOT_ACTIVE' using errcode = 'P0001';
  end if;

  insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
  values (auth.uid(), 'REMINDER_OPENED', 'registration', r.id,
          jsonb_build_object('match_id', r.match_id, 'user_id', r.user_id, 'channel', 'WHATSAPP_CLICK'));
end $$;

revoke all on function public.log_reminder_opened(uuid) from public, anon;
grant execute on function public.log_reminder_opened(uuid) to authenticated;
