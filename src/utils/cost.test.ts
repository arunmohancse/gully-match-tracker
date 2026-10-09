import { describe, expect, it } from 'vitest'
import { amountDue, canTrackPayment, computeShare, costLabel, hasPayments, isShared } from './cost'

const shared = { cost_model: 'SHARED_COST' as const, registration_fee: 0 }
const fixed = { cost_model: 'FIXED_FEE' as const, registration_fee: 150 }
const free = { cost_model: 'FIXED_FEE' as const, registration_fee: 0 }

describe('computeShare', () => {
  it('rounds the per-player amount up (2800 / 18 -> 156, 8 over)', () => {
    expect(computeShare(2800, 18)).toEqual({ exact: 2800 / 18, share: 156, surplus: 8 })
  })
  it('keeps exact divisions exact (no floating point creep)', () => {
    expect(computeShare(2700, 18)).toMatchObject({ share: 150, surplus: 0 })
    expect(computeShare(0.3, 3, 0.1)).toMatchObject({ share: 0.1, surplus: 0 })
    expect(computeShare(1000.1, 1)).toMatchObject({ share: 1001, surplus: 0.9 })
  })
  it('supports Rs 5 and Rs 10 steps', () => {
    expect(computeShare(2800, 3, 5)).toMatchObject({ share: 935, surplus: 5 })
    expect(computeShare(2800, 3, 10)).toMatchObject({ share: 940, surplus: 20 })
    expect(computeShare(2900, 3, 5)).toMatchObject({ share: 970, surplus: 10 })
  })
  it('returns null when it cannot be computed', () => {
    expect(computeShare(0, 5)).toBeNull()
    expect(computeShare(100, 0)).toBeNull()
  })
})

describe('cost model helpers', () => {
  it('knows the model', () => {
    expect(isShared(shared)).toBe(true)
    expect(isShared(fixed)).toBe(false)
  })
  it('amountDue: the share for shared cost, the fee for fixed, null when unknown or free', () => {
    expect(amountDue(shared, { amount_due: 156 })).toBe(156)
    expect(amountDue(shared, { amount_due: null })).toBeNull()
    expect(amountDue(fixed, { amount_due: null })).toBe(150)
    expect(amountDue(free, { amount_due: null })).toBeNull()
  })
  it('hasPayments: shared cost always; fixed only with a fee', () => {
    expect(hasPayments(shared)).toBe(true)
    expect(hasPayments(fixed)).toBe(true)
    expect(hasPayments(free)).toBe(false)
  })
  it('costLabel', () => {
    expect(costLabel(shared)).toMatch(/shared equally/i)
    expect(costLabel(fixed)).toBe('₹150')
    expect(costLabel(free)).toBeNull()
  })
  it('canTrackPayment: shared cost waits for the share to be calculated', () => {
    expect(canTrackPayment(shared, { amount_due: null, payment_status: 'UNPAID' })).toBe(false)
    expect(canTrackPayment(shared, { amount_due: 156, payment_status: 'UNPAID' })).toBe(true)
    expect(canTrackPayment(shared, { amount_due: null, payment_status: 'PAID' })).toBe(true)
    expect(canTrackPayment(fixed, { amount_due: null, payment_status: 'UNPAID' })).toBe(true)
    expect(canTrackPayment(free, { amount_due: null, payment_status: 'UNPAID' })).toBe(false)
  })
})
