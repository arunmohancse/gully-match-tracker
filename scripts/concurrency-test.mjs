// Concurrency test: many different users register for the same match at the same instant.
// Verifies there is no capacity overflow and that list positions are unique and contiguous.
//
// Usage (Node 22):
//   1. In the app, as admin, create an OPEN match with a small capacity (for example 5).
//   2. node --env-file=.env.local scripts/concurrency-test.mjs <matchId> [numUsers=12]
//
// It signs up numUsers throwaway accounts (loadtest+<run>-<n>@example.com), so email confirmation
// must be OFF in Supabase. Since migration 0011 new accounts start PENDING and cannot register, so approve them first
// (Admin > Players, or run the update below while the script waits). Afterwards clean up in the SQL Editor:
//   delete from public.registrations where user_id in (select id from auth.users where email like 'loadtest+%@example.com');
//   delete from public.profiles      where id      in (select id from auth.users where email like 'loadtest+%@example.com');
//   delete from auth.users           where email like 'loadtest+%@example.com';
import { createClient } from '@supabase/supabase-js'

const [matchId, usersArg] = process.argv.slice(2)
const url = process.env.VITE_SUPABASE_URL
const key = process.env.VITE_SUPABASE_ANON_KEY
const numUsers = Number(usersArg ?? 12)

if (!matchId || !url || !key) {
  console.error('Usage: node --env-file=.env.local scripts/concurrency-test.mjs <matchId> [numUsers]')
  process.exit(1)
}

const run = Date.now().toString(36)
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } })

console.log(`Signing up ${numUsers} users...`)
const clients = []
for (let i = 0; i < numUsers; i++) {
  const client = makeClient()
  const { data, error } = await client.auth.signUp({
    email: `loadtest+${run}-${i}@example.com`,
    password: 'LoadTest-1234',
    options: { data: { full_name: `Load Test ${i + 1}`, phone: `+91000000${String(i).padStart(4, '0')}` } },
  })
  if (error || !data.session) {
    console.error(`Signup ${i} failed:`, error?.message ?? 'no session (is email confirmation off?)')
    process.exit(1)
  }
  clients.push(client)
}

const before = await clients[0].rpc('get_match_counts', { p_match_ids: [matchId] })
console.log('Counts before:', before.data?.[0])

console.log('Registering all users simultaneously...')
const results = await Promise.all(clients.map((c) => c.rpc('register_for_match', { p_match_id: matchId })))
const failures = results.filter((r) => r.error)
if (failures.length) console.log('Errors:', failures.map((f) => f.error.message))

const { data: roster, error } = await clients[0].rpc('get_match_roster', { p_match_id: matchId })
if (error) throw error
const { data: match } = await clients[0].from('matches').select('max_players,status').eq('id', matchId).single()

const main = roster.filter((r) => r.list_type === 'MAIN_LIST')
const waiting = roster.filter((r) => r.list_type === 'WAITING_LIST')
const contiguous = (rows) => rows.map((r) => r.list_position).sort((a, b) => a - b).every((p, i) => p === i + 1)

const checks = [
  ['no errors', failures.length === 0],
  ['main list never exceeds capacity', main.length <= match.max_players],
  ['main list full when enough players', main.length === Math.min(match.max_players, roster.length)],
  ['main positions unique and contiguous', contiguous(main)],
  ['waiting positions unique and contiguous', contiguous(waiting)],
]
console.log(`Capacity ${match.max_players}: main=${main.length}, waiting=${waiting.length}, match status=${match.status}`)
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`)
process.exit(checks.every(([, ok]) => ok) ? 0 : 1)
