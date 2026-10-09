import { describe, expect, it } from 'vitest'
import type { MatchFinancials } from '@/types/domain'
import { filterPaymentMatches, paymentStatus } from './paymentsList'

const fin = (over: Partial<MatchFinancials> = {}): MatchFinancials => ({
  match_id: 'm', cost_model: 'FIXED_FEE', registration_fee: 100, main_count: 10, waiting_count: 0, paid_count: 10, unpaid_count: 0, waived_count: 0,
  expected: 1000, collected: 1000, pending: 0, refunds_due: 0, expenses_total: 0, balance: 1000, projected_balance: 1000,
  shares_calculated: false, shares_stale: false, share_amount: null, estimated_share: null, ...over,
})
const fixed = { cost_model: 'FIXED_FEE' as const, registration_fee: 100, match_date: '2026-10-01', status: 'COMPLETED' as const }
const shared = { cost_model: 'SHARED_COST' as const, registration_fee: 0, match_date: '2026-10-01', status: 'COMPLETED' as const }
const TODAY = '2026-10-09'

describe('paymentStatus', () => {
  it('flags unpaid players with the amount pending', () => {
    const s = paymentStatus(fixed, fin({ unpaid_count: 3, pending: 300 }), TODAY)
    expect(s).toEqual({ needsFollowUp: true, text: '3 unpaid · ₹300 pending', tone: 'warn' })
  })
  it('flags refunds before anything else', () => {
    expect(paymentStatus(fixed, fin({ refunds_due: 100, unpaid_count: 2, pending: 200 }), TODAY).text).toMatch(/^Refunds due/)
  })
  it('shows settled and free matches as not needing follow-up', () => {
    expect(paymentStatus(fixed, fin(), TODAY)).toMatchObject({ needsFollowUp: false, text: 'All paid', tone: 'good' })
    expect(paymentStatus({ ...fixed, registration_fee: 0 }, fin(), TODAY)).toMatchObject({ needsFollowUp: false, text: 'Free' })
  })
  it('flags shared-cost matches whose shares are not calculated once the match is over', () => {
    expect(paymentStatus(shared, fin({ cost_model: 'SHARED_COST' }), TODAY).needsFollowUp).toBe(true)
    expect(paymentStatus({ ...shared, match_date: '2026-10-20', status: 'OPEN' }, fin({ cost_model: 'SHARED_COST' }), TODAY).needsFollowUp).toBe(false)
  })
})

describe('filterPaymentMatches', () => {
  const list = [
    { title: 'Sunday Gully', match_date: '2026-10-04' },
    { title: 'Diwali Cup', match_date: '2026-11-01' },
    { title: 'Morning nets', match_date: '2026-09-20' },
  ]
  const text = (iso: string) => (iso === '2026-10-04' ? '4 Oct 2026' : iso)
  it('sorts newest first and splits upcoming from past', () => {
    expect(filterPaymentMatches(list, '', 'ALL', TODAY, text).map((m) => m.title)).toEqual(['Diwali Cup', 'Sunday Gully', 'Morning nets'])
    expect(filterPaymentMatches(list, '', 'UPCOMING', TODAY, text).map((m) => m.title)).toEqual(['Diwali Cup'])
    expect(filterPaymentMatches(list, '', 'PAST', TODAY, text).map((m) => m.title)).toEqual(['Sunday Gully', 'Morning nets'])
  })
  it('searches title and date text', () => {
    expect(filterPaymentMatches(list, 'gully', 'ALL', TODAY, text)).toHaveLength(1)
    expect(filterPaymentMatches(list, '4 oct', 'ALL', TODAY, text)).toHaveLength(1)
    expect(filterPaymentMatches(list, '2026-09', 'ALL', TODAY, text)).toHaveLength(1)
  })
})
