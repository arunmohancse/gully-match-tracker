import type { Match, MatchFinancials } from '@/types/domain'
import { hasPayments, isShared } from './cost'
import { formatINR } from './money'

export type Tone = 'warn' | 'good' | 'neutral'

export interface PaymentStatus {
  /** True when an admin still has something to chase or do for this match. */
  needsFollowUp: boolean
  text: string
  /** Secondary line under the text, such as the amount still pending. */
  detail?: string
  tone: Tone
}

/** One-line payment state for a match row. `today` is YYYY-MM-DD. */
export function paymentStatus(match: Pick<Match, 'cost_model' | 'registration_fee' | 'match_date' | 'status'>, f: MatchFinancials | undefined, today: string): PaymentStatus {
  if (!f) return { needsFollowUp: false, text: 'Loading...', tone: 'neutral' }
  if (!hasPayments(match)) return { needsFollowUp: false, text: 'Free', tone: 'neutral' }
  if (f.refunds_due > 0) return { needsFollowUp: true, text: 'Refunds due', detail: formatINR(f.refunds_due), tone: 'warn' }
  if (isShared(match) && !f.shares_calculated) {
    const over = match.match_date <= today || match.status === 'CLOSED' || match.status === 'COMPLETED'
    return { needsFollowUp: over && f.main_count > 0, text: 'Shares not calculated', tone: over ? 'warn' : 'neutral' }
  }
  if (f.unpaid_count > 0) return { needsFollowUp: true, text: `${f.unpaid_count} unpaid`, detail: `${formatINR(f.pending)} pending`, tone: 'warn' }
  if (f.main_count === 0) return { needsFollowUp: false, text: 'No players', tone: 'neutral' }
  return { needsFollowUp: false, text: 'All paid', tone: 'good' }
}

export type DateFilter = 'UPCOMING' | 'PAST' | 'ALL'

/** Search by title or date text (case-insensitive) and by upcoming / past. Newest match first. */
export function filterPaymentMatches<T extends Pick<Match, 'title' | 'match_date'>>(matches: T[], query: string, when: DateFilter, today: string, dateText: (iso: string) => string): T[] {
  const q = query.trim().toLowerCase()
  return matches
    .filter((m) => (when === 'ALL' ? true : when === 'UPCOMING' ? m.match_date >= today : m.match_date < today))
    .filter((m) => matchesQuery(m, q, dateText))
    .sort((a, b) => b.match_date.localeCompare(a.match_date))
}

const matchesQuery = (m: Pick<Match, 'title' | 'match_date'>, q: string, dateText: (iso: string) => string) =>
  !q || m.title.toLowerCase().includes(q) || m.match_date.includes(q) || dateText(m.match_date).toLowerCase().includes(q)

/** How many matches each date filter would show for the current search, for the filter buttons. */
export function countByFilter(matches: Pick<Match, 'title' | 'match_date'>[], query: string, today: string, dateText: (iso: string) => string): Record<DateFilter, number> {
  const q = query.trim().toLowerCase()
  const found = matches.filter((m) => matchesQuery(m, q, dateText))
  const upcoming = found.filter((m) => m.match_date >= today).length
  return { ALL: found.length, UPCOMING: upcoming, PAST: found.length - upcoming }
}

/** Heading of the list of matches that do not need follow-up. Follows the selected filter. */
export function otherMatchesHeading(when: DateFilter, hasFollowUp: boolean): string {
  if (when === 'PAST') return 'Past matches'
  if (when === 'UPCOMING') return 'Upcoming matches'
  return hasFollowUp ? 'Other matches' : 'All matches'
}

/** What to say when the current search and filter show nothing. */
export function emptyListMessage(when: DateFilter, query: string): string {
  if (query.trim()) return `No ${when === 'PAST' ? 'past ' : when === 'UPCOMING' ? 'upcoming ' : ''}matches match "${query.trim()}".`
  if (when === 'PAST') return 'No past matches yet.'
  if (when === 'UPCOMING') return 'No upcoming matches yet.'
  return 'No matches found.'
}

/** Money still to collect across the given matches, for the summary at the top. */
export function pendingSummary(rows: { status: PaymentStatus; financials: MatchFinancials | undefined }[]): { total: number; matches: number } {
  let total = 0
  let matches = 0
  for (const r of rows) {
    if (r.status.needsFollowUp && r.financials && r.financials.pending > 0) {
      total += r.financials.pending
      matches += 1
    }
  }
  return { total, matches }
}
