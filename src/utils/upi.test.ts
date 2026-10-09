import { describe, expect, it } from 'vitest'
import { buildUpiUri, isValidUpiId, paymentInstructionsText } from './upi'

describe('isValidUpiId', () => {
  it('accepts typical ids and rejects malformed ones', () => {
    for (const ok of ['arun@okhdfcbank', 'club.gully-1@ybl', '9876543210@paytm']) expect(isValidUpiId(ok)).toBe(true)
    for (const bad of ['', 'arun', '@ybl', 'arun@', 'a b@ybl', 'arun@yb l', 'arun@@ybl']) expect(isValidUpiId(bad)).toBe(false)
    expect(isValidUpiId('  arun@ybl  ')).toBe(true)
  })
})

describe('buildUpiUri', () => {
  it('builds a payment link with payee, amount in rupees and a note', () => {
    expect(buildUpiUri({ upiId: 'arun@ybl', payeeName: 'Arun Mohan', amount: 150, note: 'Sunday Match' })).toBe(
      'upi://pay?pa=arun@ybl&pn=Arun%20Mohan&am=150.00&cu=INR&tn=Sunday%20Match',
    )
  })
  it('keeps two decimals, and omits the amount, name and note when not given', () => {
    expect(buildUpiUri({ upiId: 'arun@ybl', amount: 99.5 })).toContain('am=99.50')
    expect(buildUpiUri({ upiId: 'arun@ybl' })).toBe('upi://pay?pa=arun@ybl&cu=INR')
    expect(buildUpiUri({ upiId: 'arun@ybl', amount: 0 })).not.toContain('am=')
  })
  it('encodes special characters and trims the note to 50 characters', () => {
    const uri = buildUpiUri({ upiId: 'arun@ybl', payeeName: 'A & B', note: 'x'.repeat(80) })
    expect(uri).toContain('pn=A%20%26%20B')
    expect(uri.match(/tn=(x+)/)?.[1]).toHaveLength(50)
  })
})

describe('paymentInstructionsText', () => {
  it('puts the UPI id first, then the free text', () => {
    expect(paymentInstructionsText({ upiId: 'arun@ybl', instructions: 'Pay within 2 days' })).toBe('UPI ID: arun@ybl\nPay within 2 days')
  })
  it('does not repeat a UPI id the free text already mentions', () => {
    expect(paymentInstructionsText({ upiId: 'arun@ybl', instructions: 'Pay by UPI to ARUN@ybl' })).toBe('Pay by UPI to ARUN@ybl')
  })
  it('handles either part missing, and both', () => {
    expect(paymentInstructionsText({ upiId: 'arun@ybl', instructions: '' })).toBe('UPI ID: arun@ybl')
    expect(paymentInstructionsText({ upiId: '', instructions: ' x ' })).toBe('x')
    expect(paymentInstructionsText({ upiId: '', instructions: '' })).toBe('')
  })
})
