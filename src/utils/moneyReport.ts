import type { Match, MatchFinancials } from '@/types/domain'
import { isShared } from './cost'

export interface MoneyReportRow {
  match: Match
  collected: number
  expenses: number
  balance: number
}

export interface MoneyReport {
  collected: number
  expenses: number
  balance: number
  /** Matches counted in the totals. */
  matches: number
  /** Shared-cost matches in the range whose shares are not calculated yet: left out of the totals to avoid a false loss. */
  notCalculated: number
  /** Counted matches, newest first. */
  rows: MoneyReportRow[]
}

const num = (v: unknown) => Number(v) || 0

/**
 * Collected, expenses and balance for matches dated within `from`..`to` (YYYY-MM-DD, both inclusive; null means no limit).
 * Draft and cancelled matches are skipped.
 */
export function moneyReport(matches: Match[], financials: MatchFinancials[], from: string | null, to: string | null): MoneyReport {
  const byId = new Map(financials.map((f) => [f.match_id, f]))
  const out: MoneyReport = { collected: 0, expenses: 0, balance: 0, matches: 0, notCalculated: 0, rows: [] }

  for (const m of matches) {
    if (m.status === 'DRAFT' || m.status === 'CANCELLED') continue
    if ((from && m.match_date < from) || (to && m.match_date > to)) continue
    const f = byId.get(m.id)
    if (!f) continue

    if (isShared(m) && !f.shares_calculated) {
      out.notCalculated += 1
      continue
    }
    const collected = num(f.collected)
    const expenses = num(f.expenses_total)
    out.collected += collected
    out.expenses += expenses
    out.matches += 1
    out.rows.push({ match: m, collected, expenses, balance: collected - expenses })
  }
  out.balance = out.collected - out.expenses
  out.rows.sort((a, b) => b.match.match_date.localeCompare(a.match.match_date))
  return out
}
