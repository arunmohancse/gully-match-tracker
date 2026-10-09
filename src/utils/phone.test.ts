import { describe, expect, it } from 'vitest'
import { normalizePhone } from './phone'

describe('normalizePhone', () => {
  it('adds the default country code to 10-digit numbers', () => {
    expect(normalizePhone('98765 43210')).toBe('+919876543210')
  })
  it('keeps an explicit country code', () => {
    expect(normalizePhone('+44 7700 900123')).toBe('+447700900123')
  })
  it('handles 00 prefix', () => {
    expect(normalizePhone('0044 7700 900123')).toBe('+447700900123')
  })
  it('rejects empty and too-short input', () => {
    expect(normalizePhone('')).toBeNull()
    expect(normalizePhone('123')).toBeNull()
  })
})
