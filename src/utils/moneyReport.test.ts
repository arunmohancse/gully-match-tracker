import { describe, expect, it } from 'vitest'
import type { Match, MatchFinancials } from '@/types/domain'
import { moneyReport } from './moneyReport'

const m = (id: string, date: string, over: Partial<Match> = {}): Match =>
  ({ id, match_date: date, status: 'COMPLETED', cost_model: 'FIXED_FEE', registration_fee: 100, ...over }) as Match
const f = (id: string, over: Partial<MatchFinancials> = {}): MatchFinancials =>
  ({ match_id: id, cost_model: 'FIXED_FEE', registration_fee: 100, collected: 0, expenses_total: 0, shares_calculated: false, ...over }) as MatchFinancials

const MATCHES = [m('a', '2026-08-01'), m('b', '2026-09-15'), m('c', '2026-10-10')]
const FIN = [f('a', { collected: 500, expenses_total: 100 }), f('b', { collected: 1000, expenses_total: 700 }), f('c', { collected: 50, expenses_total: 20 })]

describe('moneyReport', () => {
  it('with no dates counts every match (all time)', () => {
    const r = moneyReport(MATCHES, FIN, null, null)
    expect(r).toMatchObject({ collected: 1550, expenses: 820, balance: 730, matches: 3 })
  })
  it('keeps matches on or between the from and to dates, newest first', () => {
    const r = moneyReport(MATCHES, FIN, '2026-09-15', '2026-10-10')
    expect(r.matches).toBe(2)
    expect(r.rows.map((x) => x.match.id)).toEqual(['c', 'b'])
    expect(r.balance).toBe(330)
  })
  it('supports an open-ended range', () => {
    expect(moneyReport(MATCHES, FIN, null, '2026-08-31').matches).toBe(1)
    expect(moneyReport(MATCHES, FIN, '2026-10-01', null).matches).toBe(1)
  })
  it('leaves out and counts shared-cost matches with no calculated shares', () => {
    const r = moneyReport(
      [m('s', '2026-10-10', { cost_model: 'SHARED_COST', registration_fee: 0 })],
      [f('s', { cost_model: 'SHARED_COST', expenses_total: 1200 })],
      null,
      null,
    )
    expect(r).toMatchObject({ collected: 0, expenses: 0, matches: 0, notCalculated: 1 })
  })
  it('skips draft and cancelled matches', () => {
    const r = moneyReport([m('d', '2026-10-10', { status: 'DRAFT' }), m('x', '2026-10-10', { status: 'CANCELLED' })], [f('d', { collected: 9 }), f('x', { collected: 9 })], null, null)
    expect(r.matches).toBe(0)
  })
})
