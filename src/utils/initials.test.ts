import { describe, expect, it } from 'vitest'
import { initials } from './initials'

describe('initials', () => {
  it('uses the first and last word', () => {
    expect(initials('Arun Mohan')).toBe('AM')
    expect(initials('Amith Thampi Rajan')).toBe('AR')
    expect(initials('  arun  ')).toBe('A')
  })
  it('handles empty names', () => {
    expect(initials('')).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})
