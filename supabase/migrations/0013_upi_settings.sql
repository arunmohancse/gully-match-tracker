-- Phase 13: community-wide UPI settings, used to build pay-with-UPI links and QR codes in the app. Safe to re-run.
--
-- One UPI id and payee name for the whole community (not per match). QR codes are drawn in the browser on demand
-- from these two values plus the amount, so nothing is stored beyond the id and name.
-- Like payment_instructions: readable by logged-in users only (anon has a column-level grant that excludes them),
-- writable by admins only (the communities_admin_write policy; clients only get UPDATE on these columns).

alter table public.communities add column if not exists upi_id text;
alter table public.communities add column if not exists upi_payee_name text;

alter table public.communities drop constraint if exists communities_upi_id_check;
alter table public.communities add constraint communities_upi_id_check
  check (upi_id is null or upi_id ~ '^[A-Za-z0-9._-]{2,255}@[A-Za-z0-9]{2,64}$');

alter table public.communities drop constraint if exists communities_upi_payee_name_check;
alter table public.communities add constraint communities_upi_payee_name_check
  check (upi_payee_name is null or length(upi_payee_name) between 1 and 60);

grant update (upi_id, upi_payee_name) on public.communities to authenticated;
