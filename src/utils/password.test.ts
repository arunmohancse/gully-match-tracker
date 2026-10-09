import { describe, expect, it } from 'vitest'
import { generateTempPassword, validateNewPassword } from './password'

describe('generateTempPassword', () => {
  it('is the requested length, readable characters only, and varies', () => {
    const a = generateTempPassword()
    expect(a).toHaveLength(10)
    expect(a).toMatch(/^[a-zA-Z2-9]+$/)
    expect(a).not.toMatch(/[0OlI1]/)
    expect(generateTempPassword()).not.toBe(a)
  })
})

describe('validateNewPassword', () => {
  it('requires 8+ characters and a matching confirmation', () => {
    expect(validateNewPassword('short', 'short')).toMatch(/at least 8/)
    expect(validateNewPassword('longenough1', 'longenough2')).toMatch(/do not match/)
    expect(validateNewPassword('longenough1', 'longenough1')).toBeNull()
  })
})
