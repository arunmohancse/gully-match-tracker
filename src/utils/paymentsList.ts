import type { Match, MatchFinancials } from '@/types/domain'
import { hasPayments, isShared } from './cost'
import { formatINR } from './money'

export type Tone = 'warn' | 'good' | 'neutral'

export interface PaymentStatus {
  /** True when an admin still has something to chase or do for this match. */
  needsFollowUp: boolean
  text: string
  tone: Tone
}

/** One-line payment state for a match row. `today` is YYYY-MM-DD. */
export function paymentStatus(match: Pick<Match, 'cost_model' | 'registration_fee' | 'match_date' | 'status'>, f: MatchFinancials | undefined, today: string): PaymentStatus {
  if (!f) return { needsFollowUp: false, text: 'Loading...', tone: 'neutral' }
  if (!hasPayments(match)) return { needsFollowUp: false, text: 'Free', tone: 'neutral' }
  if (f.refunds_due > 0) return { needsFollowUp: true, text: `Refunds due ${formatINR(f.refunds_due)}`, tone: 'warn' }
  if (isShared(match) && !f.shares_calculated) {
    const over = match.match_date <= today || match.status === 'CLOSED' || match.status === 'COMPLETED'
    return { needsFollowUp: over && f.main_count > 0, text: 'Shares not calculated', tone: over ? 'warn' : 'neutral' }
  }
  if (f.unpaid_count > 0) return { needsFollowUp: true, text: `${f.unpaid_count} unpaid · ${formatINR(f.pending)} pending`, tone: 'warn' }
  if (f.main_count === 0) return { needsFollowUp: false, text: 'No players', tone: 'neutral' }
  return { needsFollowUp: false, text: 'All paid', tone: 'good' }
}

export type DateFilter = 'UPCOMING' | 'PAST' | 'ALL'

/** Search by title or date text (case-insensitive) and by upcoming / past. Newest match first. */
export function filterPaymentMatches<T extends Pick<Match, 'title' | 'match_date'>>(matches: T[], query: string, when: DateFilter, today: string, dateText: (iso: string) => string): T[] {
  const q = query.trim().toLowerCase()
  return matches
    .filter((m) => (when === 'ALL' ? true : when === 'UPCOMING' ? m.match_date >= today : m.match_date < today))
    .filter((m) => !q || m.title.toLowerCase().includes(q) || m.match_date.includes(q) || dateText(m.match_date).toLowerCase().includes(q))
    .sort((a, b) => b.match_date.localeCompare(a.match_date))
}
