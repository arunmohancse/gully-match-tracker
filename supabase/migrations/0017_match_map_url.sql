-- Phase 17: Google Maps location for a match. Safe to re-run.
--
-- Admins paste the link from Google Maps (Share, Copy link); players open it from the match page.
-- Only https links to Google Maps are accepted, so the field cannot hold an arbitrary web address.
-- The exact hosts matter: "google.com.example.com" must NOT pass, so the allowed hosts are spelled out.
-- The app applies the same rule (src/utils/mapLink.ts).

alter table public.matches add column if not exists map_url text;

alter table public.matches drop constraint if exists matches_map_url_check;
alter table public.matches add constraint matches_map_url_check check (
  map_url is null
  or (
    length(map_url) <= 500
    and map_url !~ '[[:space:]]'
    and map_url ~* '^https://(maps\.app\.goo\.gl/|goo\.gl/maps/|(www\.)?google\.(com|co\.in)/maps([/?#]|$)|maps\.google\.(com|co\.in)([/?#]|$))'
  )
);

-- Same visibility as the venue (public, including logged-out visitors on the shared match page); only admins write it.
-- Matches use column-level privileges (see 0002 / 0008 / 0009), so the new column needs its own grants.
grant select (map_url) on public.matches to anon, authenticated;
grant insert (map_url) on public.matches to authenticated;
grant update (map_url) on public.matches to authenticated;
