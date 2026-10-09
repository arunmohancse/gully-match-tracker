# Cricket Club: Match Registration & Payments

Community cricket match registration, waiting list, payment tracking, expenses and WhatsApp payment reminders.
React + TypeScript + Vite + Tailwind + Supabase (Postgres, Auth, RLS, Storage). No custom backend server.

## Setup

1. `npm install` (this repo's `.npmrc` points at the public npm registry)
2. Create a Supabase project. In **Authentication, Providers, Email**, turn off "Confirm email" for development.
3. Copy `.env.example` to `.env.local` and fill in the project URL and the anon / publishable key
   (Project Settings, API). Never put the `service_role` key in the app.
4. Apply the database migrations **in order** by pasting each file into the Supabase SQL Editor and running it
   (the editor warns about "destructive operations" because the scripts drop and recreate their own triggers
   and policies; that is expected). Or use the Supabase CLI: `supabase link` then `supabase db push`.

   | File | Adds |
   |---|---|
   | `0001_communities_profiles.sql` | communities, profiles, signup trigger, role helpers, RLS |
   | `0002_matches_audit_storage.sql` | matches, audit log, image bucket |
   | `0003_fix_role_change_guard.sql` | lets the SQL Editor promote the first admin |
   | `0004_registrations.sql` | registrations, atomic `register_for_match`, roster and counts |
   | `0005_cancellation_promotion.sql` | cancel, automatic promotion, admin moves, capacity changes |
   | `0006_payments_expenses.sql` | payment changes, financial totals, expenses |
   | `0007_reminder_log.sql` | records opened WhatsApp reminders |
   | `0008_security_hardening.sql` | hides internal `matches` columns from clients |
   | `0010_set_user_role.sql` | admins can promote players to admin (or remove admin) from the Players page |
   | `0011_account_status_passwords.sql` | signup approval (new users start pending), blocking, admin-set temporary passwords, admin-enabled "reset password" |
   | `0012_list_players.sql` | paged, searchable player list (replaces downloading every player and registration) |
   | `0013_upi_settings.sql` | community-wide UPI id and payee name, used for pay-with-UPI links and QR codes |
   | `0009_shared_cost.sql` | shared-cost matches: expenses split equally after the match, per-player amount due, payment instructions |

   Then run `supabase/seed.sql` once (creates the community).
5. `npm run dev`

## Making the first admin

Sign up in the app, then run in the SQL Editor:

```sql
update public.profiles set role = 'ADMIN', status = 'ACTIVE' where id = (select id from auth.users where email = 'you@example.com');
```

## Scripts

`npm run dev` · `npm run build` · `npm run lint` · `npm test`

## Tests

| What | How |
|---|---|
| App logic (dates, money, announcements, reminders, audit text, errors) | `npm test` |
| Registration rules, positions, privacy, authorization | run `supabase/tests/phase3_registration.sql` in the SQL Editor |
| Cancellation, promotion, admin moves, capacity | `supabase/tests/phase4_cancellation.sql` |
| Payments, totals, expenses, authorization | `supabase/tests/phase5_payments.sql` |
| Reminder log | `supabase/tests/phase7_reminders.sql` |
| Promoting / demoting admins | `supabase/tests/phase10_roles.sql` |
| Signup approval, blocking, password resets | `supabase/tests/phase11_status_passwords.sql` |
| Paged player list (search, filters, paging) | `supabase/tests/phase12_list_players.sql` |
| Shared-cost settlement (rounding, staleness, privacy) | `supabase/tests/phase9_shared_cost.sql` |
| Permissions and RLS review (read-only) | `supabase/tests/security_review.sql`. Re-run after every new migration. |
| Simultaneous registrations | `node --env-file=.env.local scripts/concurrency-test.mjs <matchId> 12` (see the script header; it creates throwaway users) |

The SQL tests run inside a transaction that is rolled back, so they keep no data. Each ends with an "ALL ... PASSED" row.

## Deployment checklist

- **Vercel:** import the GitHub repo; `vercel.json` already sets the Vite build and the rewrite of all paths to `/index.html`. Add the three environment variables below under Project Settings, Environment Variables (Production), then redeploy.
- Host the built `dist/` on any static host (Netlify, Vercel, Cloudflare Pages, ...). Single-page app: **rewrite all paths to `/index.html`**,
  otherwise opening a shared `/matches/<id>` link directly returns 404.
- Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and **`VITE_PUBLIC_APP_URL`** (your public address, e.g. `https://cricket.example.com`)
  as build-time environment variables. `VITE_PUBLIC_APP_URL` is what shared WhatsApp links use, and only real domains become tappable links.
- Supabase, Authentication, URL Configuration: set the **Site URL** to the same public address.
- Supabase, Authentication: turn **on** "Confirm email" for production, and raise the minimum password length (the app asks for 8).
  Consider enabling leaked-password protection if your plan has it.
- Run `supabase/tests/security_review.sql` against the production project.
- Promote your first admin account with the SQL above. After that, admins can promote others from **Admin, Players**.

## Maintenance

- **Wipe test data before going live:** `supabase/scripts/clear_matches_and_expenses.sql` deletes all matches, registrations, payments, expenses and their activity history, and keeps users. It does nothing until you change one confirmation line (see the file header).
- Announcement images are deleted automatically when replaced. To find any strays (for example from an interrupted upload):

  ```sql
  select name from storage.objects
   where bucket_id = 'match-images'
     and name not in (select image_path from public.matches where image_path is not null);
  ```
- Test accounts created by the concurrency script can be removed with the SQL in that script's header.
- Every important admin action is in the audit log, viewable in the app under **Admin, Dashboard, View activity log**.

## Cost models

Each match is either **Shared after the match** (the default for new matches) or a **Fixed fee per player**.
With shared cost there is no fee up front: after the match, add the expenses, close registration (or mark the match completed),
then open the match and click **Calculate shares**. The total is divided equally among the main-list players and rounded up
to the next ₹1, ₹5 or ₹10. Each player then sees their share, the admin tracks payments against it, and WhatsApp reminders carry
the amount and the community's payment instructions (Admin, Payments, "Payment instructions"). If the expenses or the main list
change afterwards the app tells you the shares are out of date, and you recalculate (existing payments are kept).

## How it works (short)

- All registration and payment changes happen in Postgres functions that first lock the match row, so two people
  registering at once can never overflow the main list. The browser never writes those tables directly.
- Authorization is enforced by Row Level Security, column-level grants and role checks inside the functions.
  Hiding buttons in React is only for convenience.
- WhatsApp reminders use Click-to-Chat behind a `NotificationService` interface
  (`src/services/notificationService.ts`); the WhatsApp Business API can replace it later without touching the core logic.

## Branding

Name, tagline, logo and colour live in one file: `src/config/brand.ts` (instructions at the top of it).
Put your logo in `public/` (for example `public/logo.svg`), replace `public/favicon-32.png`, `apple-touch-icon.png` and `icon-192.png` for the browser-tab and home-screen icons,
and keep `themeColor` equal to `--color-brand` in `src/index.css` (a test checks this).
