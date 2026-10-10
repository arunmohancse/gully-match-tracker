-- Phase 18: also accept share.google links in the match map link. Safe to re-run.
-- Google gives these short links (https://share.google/xxxx) when a place is shared from the Google app or Search.
-- Same rule as 0017 otherwise; the app applies it too (src/utils/mapLink.ts).

alter table public.matches drop constraint if exists matches_map_url_check;
alter table public.matches add constraint matches_map_url_check check (
  map_url is null
  or (
    length(map_url) <= 500
    and map_url !~ '[[:space:]]'
    and map_url ~* '^https://(maps\.app\.goo\.gl/|share\.google/.|goo\.gl/maps/|(www\.)?google\.(com|co\.in)/maps([/?#]|$)|maps\.google\.(com|co\.in)([/?#]|$))'
  )
);
