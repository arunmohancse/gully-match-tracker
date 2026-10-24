import { describe, expect, it } from 'vitest'
import { parseThemePreference, resolveTheme } from './theme'

describe('theme', () => {
  it('reads a saved choice, falling back to system for anything else', () => {
    expect(parseThemePreference('light')).toBe('light')
    expect(parseThemePreference('dark')).toBe('dark')
    expect(parseThemePreference('system')).toBe('system')
    expect(parseThemePreference(null)).toBe('system')
    expect(parseThemePreference('purple')).toBe('system')
  })
  it('an explicit choice wins over the phone setting', () => {
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })
  it('system follows the phone setting', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
  })
})
