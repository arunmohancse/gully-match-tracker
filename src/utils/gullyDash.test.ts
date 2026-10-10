import { describe, expect, it } from 'vitest'
import { deliverySpeed, hitWindow, runsForTiming } from './gullyDash'

describe('difficulty', () => {
  it('speeds up and narrows, but stays within limits', () => {
    expect(deliverySpeed(0)).toBe(220)
    expect(deliverySpeed(5)).toBeGreaterThan(deliverySpeed(0))
    expect(deliverySpeed(1000)).toBe(400)
    expect(hitWindow(0)).toBe(38)
    expect(hitWindow(5)).toBeLessThan(hitWindow(0))
    expect(hitWindow(1000)).toBe(22)
  })
})

describe('runsForTiming', () => {
  it('pays more for better timing, on either side', () => {
    expect(runsForTiming(0, 30)).toBe(6)
    expect(runsForTiming(-5, 30)).toBe(6)
    expect(runsForTiming(10, 30)).toBe(4)
    expect(runsForTiming(-20, 30)).toBe(2)
    expect(runsForTiming(30, 30)).toBe(1)
  })
  it('is a miss outside the window', () => {
    expect(runsForTiming(31, 30)).toBeNull()
    expect(runsForTiming(-60, 30)).toBeNull()
  })
})
