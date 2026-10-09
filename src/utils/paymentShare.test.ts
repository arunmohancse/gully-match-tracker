import { describe, expect, it } from 'vitest'
import type { AdminRegistration, Match } from '@/types/domain'
import { amountPerPlayer, buildPaymentRequest, buildPendingList, pendingPlayers } from './paymentShare'

const shared = { id: 'm1', title: 'Sunday Match', match_date: '2026-10-18', venue: 'Velocity Turf', cost_model: 'SHARED_COST', registration_fee: 0 } as Match
const fixed = { ...shared, cost_model: 'FIXED_FEE', registration_fee: 150 } as Match

const reg = (name: string, pos: number, over: Partial<AdminRegistration> = {}): AdminRegistration =>
  ({ status: 'ACTIVE', list_type: 'MAIN_LIST', list_position: pos, payment_status: 'UNPAID', amount_due: 150, player: { full_name: name, phone: null }, ...over }) as AdminRegistration

describe('amountPerPlayer', () => {
  it('uses the calculated share for shared-cost matches, and is unknown until calculated', () => {
    expect(amountPerPlayer(shared, { shares_calculated: true, share_amount: 140 })).toBe(140)
    expect(amountPerPlayer(shared, { shares_calculated: false, share_amount: null })).toBeNull()
    expect(amountPerPlayer(shared, undefined)).toBeNull()
  })
  it('uses the fee for fixed-fee matches and nothing for free ones', () => {
    expect(amountPerPlayer(fixed, undefined)).toBe(150)
    expect(amountPerPlayer({ ...fixed, registration_fee: 0 }, undefined)).toBeNull()
  })
})

describe('buildPaymentRequest', () => {
  it('is a general message with the amount and where to pay, and no player names', () => {
    const text = buildPaymentRequest(shared, 150, 12, 'UPI: arun@upi')
    expect(text).toContain('*SUNDAY MATCH - PAYMENT*')
    expect(text).toContain('Share per player: ₹150 (12 players)')
    expect(text).toContain('Please pay to:\nUPI: arun@upi')
    expect(text).not.toMatch(/pending|1\./i)
  })
  it('leaves out the pay-to block when no instructions are set', () => {
    expect(buildPaymentRequest(fixed, 150, 10, '  ')).not.toContain('Please pay to')
    expect(buildPaymentRequest(fixed, 150, 10, null)).toContain('Match fee per player: ₹150')
  })
})

describe('pendingPlayers / buildPendingList', () => {
  const regs = [
    reg('Chitra', 3),
    reg('Arun', 1, { payment_status: 'PAID' }),
    reg('Bala', 2),
    reg('Waived Wes', 4, { payment_status: 'WAIVED' }),
    reg('Wait Wendy', 1, { list_type: 'WAITING_LIST' }),
    reg('Gone Gita', 5, { status: 'CANCELLED' }),
    reg('No Share Nita', 6, { amount_due: null }),
  ]
  it('lists only unpaid main-list players with a known amount, in list order', () => {
    expect(pendingPlayers(shared, regs).map((p) => p.name)).toEqual(['Bala', 'Chitra'])
  })
  it('writes a friendly numbered list with the shared amount once', () => {
    const text = buildPendingList(shared, pendingPlayers(shared, regs), 'UPI: arun@upi')
    expect(text).toContain('*SUNDAY MATCH - PENDING PAYMENTS*')
    expect(text).toContain('1. Bala\n2. Chitra')
    expect(text).toContain('Amount: ₹150 each')
    expect(text).toContain('Please pay to:\nUPI: arun@upi')
  })
  it('shows each amount when they differ', () => {
    const text = buildPendingList(shared, [{ name: 'A', amount: 100 }, { name: 'B', amount: 150 }], null)
    expect(text).toContain('1. A - ₹100\n2. B - ₹150')
    expect(text).not.toContain('each')
  })
})
