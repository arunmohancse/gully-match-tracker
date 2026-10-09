import { describe, expect, it } from 'vitest'
import type { Match, MatchFinancials } from '@/types/domain'
import { moneySummary } from './moneySummary'

const m = (id: string, date: string, over: Partial<Match> = {}): Match =>
  ({ id, match_date: date, status: 'COMPLETED', cost_model: 'FIXED_FEE', registration_fee: 100, ...over }) as Match
const f = (id: string, over: Partial<MatchFinancials> = {}): MatchFinancials =>
  ({ match_id: id, cost_model: 'FIXED_FEE', registration_fee: 100, main_count: 10, unpaid_count: 0, pending: 0, collected: 0, refunds_due: 0, expenses_total: 0, shares_calculated: false, ...over }) as MatchFinancials

const TODAY = '2026-10-20'
const FROM = '2026-09-20'

describe('moneySummary', () => {
  it('adds up pending across every match, whatever its date, and counts the ones to chase', () => {
    const s = moneySummary(
      [m('old', '2026-06-01'), m('new', '2026-10-10'), m('paid', '2026-10-12')],
      [f('old', { unpaid_count: 2, pending: 200 }), f('new', { unpaid_count: 1, pending: 100 }), f('paid', { collected: 1000 })],
      TODAY,
      FROM,
    )
    expect(s.pending).toBe(300)
    expect(s.followUpCount).toBe(2)
  })
  it('counts collected and expenses for matches from the cut-off date onwards, including upcoming ones', () => {
    const s = moneySummary(
      [m('old', '2026-06-01'), m('recent', '2026-10-10'), m('future', '2026-11-01')],
      [f('old', { collected: 500, expenses_total: 100 }), f('recent', { collected: 1000, expenses_total: 700 }), f('future', { collected: 50, expenses_total: 20 })],
      TODAY,
      FROM,
    )
    expect(s.recent).toEqual({ collected: 1050, expenses: 720, balance: 330, matches: 2 })
  })
  it('leaves out shared-cost matches whose shares are not calculated, so there is no false loss', () => {
    const s = moneySummary(
      [m('shared', '2026-10-10', { cost_model: 'SHARED_COST', registration_fee: 0 })],
      [f('shared', { cost_model: 'SHARED_COST', expenses_total: 1200, shares_calculated: false })],
      TODAY,
      FROM,
    )
    expect(s.recent).toEqual({ collected: 0, expenses: 0, balance: 0, matches: 0 })
  })
  it('skips draft and cancelled matches and sums refunds due', () => {
    const s = moneySummary(
      [m('d', '2026-10-10', { status: 'DRAFT' }), m('c', '2026-10-10', { status: 'CANCELLED' }), m('ok', '2026-10-10')],
      [f('d', { pending: 999 }), f('c', { pending: 999 }), f('ok', { refunds_due: 150 })],
      TODAY,
      FROM,
    )
    expect(s.pending).toBe(0)
    expect(s.refundsDue).toBe(150)
    expect(s.followUpCount).toBe(1)
  })
})
