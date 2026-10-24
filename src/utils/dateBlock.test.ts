import { describe, expect, it } from 'vitest'
import { dateBlockParts, durationLabel, relativeDayLabel } from './dates'

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

describe('durationLabel', () => {
  it('describes the game length', () => {
    expect(durationLabel('06:00', '08:00')).toBe('2 hour game')
    expect(durationLabel('06:00', '07:30')).toBe('1 hr 30 min game')
    expect(durationLabel('06:00', '06:45')).toBe('45 min game')
  })

  it('is null without a later end time', () => {
    expect(durationLabel('06:00', '')).toBeNull()
    expect(durationLabel('08:00', '06:00')).toBeNull()
  })
})
