import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import { AUDIT_CATEGORIES, type AuditCategory, type AuditEntry, type AuditNames } from '@/utils/audit'

export const AUDIT_PAGE_SIZE = 50

export interface AuditPage {
  entries: AuditEntry[]
  names: AuditNames
  /** created_at of the last entry, or null when there is nothing more to load. */
  nextCursor: string | null
}

const uniq = (ids: (string | null | undefined)[]) => [...new Set(ids.filter((x): x is string => !!x))]

export const auditService = {
  /** Admin only (RLS). Newest first, keyset-paginated by created_at. */
  async list(args: { category: AuditCategory; matchId: string; before: string | null }): Promise<AuditPage> {
    let query = supabase
      .from('audit_logs')
      .select('id, action, entity_type, entity_id, metadata, created_at, actor:profiles(full_name)')
      .order('created_at', { ascending: false })
      .limit(AUDIT_PAGE_SIZE)
    const actions = AUDIT_CATEGORIES[args.category].actions
    if (actions.length > 0) query = query.in('action', [...actions])
    if (args.matchId) query = query.or(`metadata->>match_id.eq.${args.matchId},entity_id.eq.${args.matchId}`)
    if (args.before) query = query.lt('created_at', args.before)

    const entries = (unwrap(await query) ?? []) as unknown as AuditEntry[]

    // Resolve player and match names for the sentences (admins can read both tables).
    const userIds = uniq(entries.map((e) => (typeof e.metadata?.user_id === 'string' ? e.metadata.user_id : null)))
    const matchIds = uniq(entries.map((e) => (e.entity_type === 'match' ? e.entity_id : typeof e.metadata?.match_id === 'string' ? e.metadata.match_id : null)))
    const [users, matches] = await Promise.all([
      userIds.length ? supabase.from('profiles').select('id, full_name').in('id', userIds) : Promise.resolve({ data: [], error: null }),
      matchIds.length ? supabase.from('matches').select('id, title').in('id', matchIds) : Promise.resolve({ data: [], error: null }),
    ])

    const names: AuditNames = { users: {}, matches: {} }
    for (const u of (unwrap(users) ?? []) as { id: string; full_name: string }[]) names.users[u.id] = u.full_name
    for (const m of (unwrap(matches) ?? []) as { id: string; title: string }[]) names.matches[m.id] = m.title

    return {
      entries,
      names,
      nextCursor: entries.length === AUDIT_PAGE_SIZE ? entries[entries.length - 1].created_at : null,
    }
  },
}
