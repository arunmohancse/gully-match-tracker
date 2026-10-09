import { describe, expect, it } from 'vitest'
import type { RegistrationWithMatch } from '@/types/domain'
import { myDues } from './dues'

const reg = (id: string, date: string, over: Record<string, unknown> = {}, matchOver: Record<string, unknown> = {}): RegistrationWithMatch =>
  ({
    id, status: 'ACTIVE', list_type: 'MAIN_LIST', payment_status: 'UNPAID', amount_due: 150,
    match: { match_date: date, status: 'COMPLETED', cost_model: 'SHARED_COST', registration_fee: 0, ...matchOver },
    ...over,
  }) as unknown as RegistrationWithMatch

describe('myDues', () => {
  it('lists unpaid main-list registrations with an amount, oldest first, and totals them', () => {
    const { dues, total } = myDues([reg('b', '2026-10-11'), reg('a', '2026-10-04', { amount_due: 120 })])
    expect(dues.map((d) => d.registration.id)).toEqual(['a', 'b'])
    expect(total).toBe(270)
  })
  it('ignores paid, waived, waiting, cancelled registrations and cancelled or draft matches', () => {
    const { dues } = myDues([
      reg('paid', '2026-10-01', { payment_status: 'PAID' }),
      reg('waived', '2026-10-01', { payment_status: 'WAIVED' }),
      reg('waiting', '2026-10-01', { list_type: 'WAITING_LIST' }),
      reg('gone', '2026-10-01', { status: 'CANCELLED' }),
      reg('matchgone', '2026-10-01', {}, { status: 'CANCELLED' }),
      reg('draft', '2026-10-01', {}, { status: 'DRAFT' }),
    ])
    expect(dues).toHaveLength(0)
  })
  it('skips shared-cost registrations whose share is not calculated yet, and free matches', () => {
    expect(myDues([reg('x', '2026-10-01', { amount_due: null })]).dues).toHaveLength(0)
    expect(myDues([reg('y', '2026-10-01', {}, { cost_model: 'FIXED_FEE', registration_fee: 0 })]).dues).toHaveLength(0)
  })
  it('uses the fixed fee for fixed-fee matches', () => {
    const { dues, total } = myDues([reg('z', '2026-10-01', { amount_due: null }, { cost_model: 'FIXED_FEE', registration_fee: 200 })])
    expect(dues).toHaveLength(1)
    expect(total).toBe(200)
  })
})
