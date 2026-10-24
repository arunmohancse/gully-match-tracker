import { describe, expect, it } from 'vitest'
import { dateBlockParts, relativeDayLabel } from './dates'

describe('dateBlockParts', () => {
  it('splits a date into the card calendar block', () => {
    expect(dateBlockParts('2026-10-25')).toEqual({ day: '25', month: 'OCT', weekday: 'SUN' })
    expect(dateBlockParts('2026-11-07')).toEqual({ day: '07', month: 'NOV', weekday: 'SAT' })
  })
})

describe('relativeDayLabel', () => {
  it('says today / tomorrow / in N days for the coming week', () => {
    expect(relativeDayLabel('2026-10-24', '2026-10-24')).toBe('Today')
    expect(relativeDayLabel('2026-10-25', '2026-10-24')).toBe('Tomorrow')
    expect(relativeDayLabel('2026-10-31', '2026-10-24')).toBe('Saturday')
    expect(relativeDayLabel('2026-10-29', '2026-10-24')).toBe('In 5 days')
  })
  it('works across a month end', () => {
    expect(relativeDayLabel('2026-11-01', '2026-10-31')).toBe('Tomorrow')
  })
})
