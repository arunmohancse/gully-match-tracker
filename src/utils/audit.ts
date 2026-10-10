import { formatINR } from './money'

export interface AuditEntry {
  id: string
  action: string
  entity_type: string
  entity_id: string | null
  metadata: Record<string, unknown>
  created_at: string
  actor: { full_name: string } | null
}

export interface AuditNames {
  users: Record<string, string>
  matches: Record<string, string>
}

export const AUDIT_CATEGORIES = {
  ALL: { label: 'All activity', actions: [] as string[] },
  REGISTRATIONS: { label: 'Registrations', actions: ['REGISTRATION_CREATED', 'REGISTRATION_CANCELLED', 'PLAYER_PROMOTED', 'PLAYER_MOVED'] },
  PAYMENTS: { label: 'Payments', actions: ['PAYMENT_MARKED_PAID', 'PAYMENT_MARKED_UNPAID', 'PAYMENT_MARKED_REFUNDED', 'PAYMENT_WAIVED', 'SHARES_CALCULATED'] },
  MATCHES: { label: 'Matches', actions: ['MATCH_CREATED', 'MATCH_UPDATED', 'MATCH_CANCELLED'] },
  EXPENSES: { label: 'Expenses', actions: ['EXPENSE_ADDED', 'EXPENSE_UPDATED', 'EXPENSE_DELETED'] },
  REMINDERS: { label: 'Reminders', actions: ['REMINDER_OPENED'] },
  PEOPLE: { label: 'People and accounts', actions: ['ROLE_CHANGED', 'USER_STATUS_CHANGED', 'PASSWORD_SET_BY_ADMIN', 'PASSWORD_RESET_ENABLED', 'PASSWORD_RESET_DISABLED', 'PASSWORD_RESET_USED'] },
} as const

export type AuditCategory = keyof typeof AUDIT_CATEGORIES

const FIELD_LABELS: Record<string, string> = {
  title: 'title', description: 'description', match_date: 'date', start_time: 'start time', end_time: 'end time', venue: 'venue', map_url: 'map location',
  max_players: 'maximum players', registration_fee: 'fee', cost_model: 'cost model', registration_opens_at: 'registration opening', registration_closes_at: 'registration closing',
  rules: 'rules', image_path: 'image', status: 'status',
}

const listName = (v: unknown) => (v === 'MAIN_LIST' ? 'the main list' : v === 'WAITING_LIST' ? 'the waiting list' : 'a list')
const str = (v: unknown) => (typeof v === 'string' ? v : '')

/** One plain-English sentence for an audit row. Falls back to the raw action name for unknown actions. */
export function describeAudit(entry: AuditEntry, names: AuditNames): string {
  const m = entry.metadata ?? {}
  const actor = entry.actor?.full_name ?? 'Someone'
  const player = names.users[str(m.user_id)] ?? 'a player'
  const matchId = entry.entity_type === 'match' ? (entry.entity_id ?? '') : str(m.match_id)
  const match = names.matches[matchId]
  const onMatch = match ? ` for "${match}"` : ''

  switch (entry.action) {
    case 'MATCH_CREATED':
      return `${actor} created the match "${str(m.title) || match || 'unknown'}"`
    case 'MATCH_CANCELLED':
      return `${actor} cancelled the match${match ? ` "${match}"` : ''}`
    case 'MATCH_UPDATED': {
      const changes = (m.changes ?? {}) as Record<string, { from?: unknown; to?: unknown }>
      const fields = Object.keys(changes).map((k) => FIELD_LABELS[k] ?? k)
      const status = changes.status
      const statusPart = status ? ` (status ${str(status.from)} → ${str(status.to)})` : ''
      return `${actor} updated the match${match ? ` "${match}"` : ''}: ${fields.join(', ') || 'details'}${statusPart}`
    }
    case 'REGISTRATION_CREATED':
      return `${player} registered${onMatch} (${listName(m.list_type).replace('the ', '')})`
    case 'REGISTRATION_CANCELLED':
      return m.by_admin ? `${actor} cancelled ${player}'s registration${onMatch}` : `${player} cancelled their registration${onMatch}`
    case 'PLAYER_PROMOTED':
      return `${player} was moved up to the main list${onMatch}`
    case 'PLAYER_MOVED':
      return `${actor} moved ${player} from ${listName(m.from)} to ${listName(m.to)}${onMatch}`
    case 'PAYMENT_MARKED_PAID': {
      const details = [m.amount != null ? formatINR(Number(m.amount)) : '', str(m.method), str(m.reference) ? `ref ${str(m.reference)}` : ''].filter(Boolean)
      return `${actor} marked ${player} as paid${details.length ? ` (${details.join(', ')})` : ''}${onMatch}`
    }
    case 'PAYMENT_MARKED_UNPAID':
      return `${actor} marked ${player}'s payment as unpaid${onMatch}`
    case 'PAYMENT_MARKED_REFUNDED':
      return `${actor} marked ${player}'s payment as refunded${onMatch}`
    case 'PAYMENT_WAIVED':
      return `${actor} waived ${player}'s fee${onMatch}`
    case 'ROLE_CHANGED':
      return m.to === 'ADMIN' ? `${actor} made ${player} an admin` : `${actor} removed admin rights from ${player}`
    case 'USER_STATUS_CHANGED':
      return m.to === 'BLOCKED' ? `${actor} blocked ${player}` : m.from === 'PENDING' ? `${actor} approved ${player}` : `${actor} unblocked ${player}`
    case 'PASSWORD_SET_BY_ADMIN':
      return `${actor} set a temporary password for ${player}`
    case 'PASSWORD_RESET_ENABLED':
      return `${actor} allowed ${player} to reset their password`
    case 'PASSWORD_RESET_DISABLED':
      return `${actor} turned off password reset for ${player}`
    case 'PASSWORD_RESET_USED':
      return `${player} reset their password`
    case 'SHARES_CALCULATED':
      return `${actor} calculated the shares${onMatch}: ${formatINR(Number(m.total_expenses ?? 0))} among ${Number(m.participants ?? 0)} players = ${formatINR(Number(m.share_amount ?? 0))} each`
    case 'EXPENSE_ADDED':
      return `${actor} added an expense: ${str(m.description)} ${formatINR(Number(m.amount ?? 0))}${onMatch}`
    case 'EXPENSE_UPDATED': {
      const to = (m.to ?? {}) as { description?: string; amount?: number }
      return `${actor} edited an expense: ${str(to.description)} ${formatINR(Number(to.amount ?? 0))}${onMatch}`
    }
    case 'EXPENSE_DELETED':
      return `${actor} deleted an expense: ${str(m.description)} ${formatINR(Number(m.amount ?? 0))}${onMatch}`
    case 'REMINDER_OPENED':
      return `${actor} opened a WhatsApp reminder for ${player}${onMatch}`
    default:
      return `${actor}: ${entry.action}`
  }
}
