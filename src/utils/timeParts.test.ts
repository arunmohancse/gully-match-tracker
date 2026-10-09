import { describe, expect, it } from 'vitest'
import { joinTime, splitTime } from './timeParts'

describe('splitTime / joinTime', () => {
  it('converts 24-hour values to 12-hour parts', () => {
    expect(splitTime('06:30')).toEqual({ hour: '6', minute: '30', period: 'AM' })
    expect(splitTime('18:05')).toEqual({ hour: '6', minute: '05', period: 'PM' })
    expect(splitTime('00:00')).toEqual({ hour: '12', minute: '00', period: 'AM' })
    expect(splitTime('12:15')).toEqual({ hour: '12', minute: '15', period: 'PM' })
    expect(splitTime('')).toEqual({ hour: '', minute: '00', period: 'AM' })
  })
  it('round-trips every minute of the day', () => {
    for (let h = 0; h < 24; h++) {
      for (const mm of ['00', '15', '45', '59']) {
        const v = `${String(h).padStart(2, '0')}:${mm}`
        expect(joinTime(splitTime(v))).toBe(v)
      }
    }
  })
  it('gives an empty value when no hour is chosen', () => {
    expect(joinTime({ hour: '', minute: '30', period: 'PM' })).toBe('')
  })
})
