-- Development seed (local only). Full seed (users, match) arrives with later phases.
insert into public.communities (name, slug)
values ('Gully League Trivandrum', 'gully-league-trivandrum')
on conflict (slug) do nothing;
