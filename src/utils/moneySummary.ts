import type { Match, MatchFinancials } from '@/types/domain'
import { isShared } from './cost'
import { paymentStatus } from './paymentsList'

export interface MoneySummary {
  /** Still owed by unpaid players, across every match. */
  pending: number
  /** Matches that need chasing (unpaid players, refunds due, or shares not calculated after the match). */
  followUpCount: number
  /** Money owed back to cancelled players who had paid. */
  refundsDue: number
  /** Matches from `recentFrom` onwards, including upcoming ones: collected, expenses and the difference. Shared-cost matches whose shares are not calculated yet are left out. */
  recent: { collected: number; expenses: number; balance: number; matches: number }
}

const num = (v: unknown) => Number(v) || 0

/**
 * Admin dashboard money figures.
 * `recentFrom` is the earliest match date (YYYY-MM-DD) counted in the "recent" figures; there is no upper limit, because money for an upcoming match is received money too.
 */
export function moneySummary(matches: Match[], financials: MatchFinancials[], today: string, recentFrom: string): MoneySummary {
  const byId = new Map(financials.map((f) => [f.match_id, f]))
  const out: MoneySummary = { pending: 0, followUpCount: 0, refundsDue: 0, recent: { collected: 0, expenses: 0, balance: 0, matches: 0 } }

  for (const m of matches) {
    if (m.status === 'DRAFT' || m.status === 'CANCELLED') continue
    const f = byId.get(m.id)
    if (!f) continue

    out.pending += num(f.pending)
    out.refundsDue += num(f.refunds_due)
    if (paymentStatus(m, f, today).needsFollowUp) out.followUpCount += 1

    const settled = !isShared(m) || f.shares_calculated // a shared match with no shares yet would show a false loss
    if (m.match_date >= recentFrom && settled) {
      out.recent.collected += num(f.collected)
      out.recent.expenses += num(f.expenses_total)
      out.recent.matches += 1
    }
  }
  out.recent.balance = out.recent.collected - out.recent.expenses
  return out
}
