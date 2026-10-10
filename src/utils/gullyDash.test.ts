import { describe, expect, it } from 'vitest'
import { ballHeight, deliverySpeed, hitWindow, makeDelivery, RELEASE_DISTANCE, runsForTiming, STEADY_BALLS } from './gullyDash'

describe('difficulty', () => {
  it('keeps the first over steady, whatever the random numbers', () => {
    for (let n = 0; n < STEADY_BALLS; n++) {
      expect(deliverySpeed(n, () => 0)).toBe(220)
      expect(deliverySpeed(n, () => 0.99)).toBe(220)
    }
  })
  it('varies the speed after the first over, within a band that creeps up and is capped', () => {
    expect(deliverySpeed(STEADY_BALLS, () => 0)).toBeLessThan(220)
    expect(deliverySpeed(STEADY_BALLS, () => 0.999)).toBeGreaterThan(300)
    expect(deliverySpeed(STEADY_BALLS + 10, () => 0.5)).toBeGreaterThan(deliverySpeed(STEADY_BALLS, () => 0.5))
    expect(deliverySpeed(1000, () => 0.999)).toBeLessThanOrEqual(602)
    expect(deliverySpeed(1000, () => 0)).toBeGreaterThanOrEqual(258)
  })
  it('narrows the hit window, but stays within limits', () => {
    expect(hitWindow(0)).toBe(38)
    expect(hitWindow(5)).toBeLessThan(hitWindow(0))
    expect(hitWindow(1000)).toBe(13)
  })
})

describe('makeDelivery', () => {
  it('keeps the first over steady: same speed, no pace change, one normal pitch', () => {
    for (const r of [0, 0.5, 0.99]) {
      const d = makeDelivery(0, () => r)
      expect(d.speed).toBe(220)
      expect(d.paceChange).toBeNull()
      expect(d.pitches).toHaveLength(1)
    }
  })
  it('after the first over, mostly pitches once, sometimes bowls a full toss or pitches twice', () => {
    expect(makeDelivery(STEADY_BALLS, () => 0.1).pitches).toEqual([])
    expect(makeDelivery(STEADY_BALLS, () => 0.2).pitches).toHaveLength(2)
    expect(makeDelivery(STEADY_BALLS, () => 0.6).pitches).toHaveLength(1)
  })
  it('after the first over, can change pace in flight, and waits a random time', () => {
    const d = makeDelivery(STEADY_BALLS, () => 0) // rand 0: always changes pace, shortest wait, slowest
    expect(d.paceChange).not.toBeNull()
    expect(d.paceChange!.factor).toBeCloseTo(0.55)
    expect(d.wait).toBeCloseTo(0.3)
    expect(makeDelivery(STEADY_BALLS, () => 0.999).wait).toBeGreaterThan(1.1)
  })
  it('never plans anything outside sensible limits, however long you last', () => {
    for (let i = 0; i < 500; i++) {
      const d = makeDelivery(i % 80)
      expect(d.speed).toBeGreaterThan(100)
      expect(d.speed).toBeLessThanOrEqual(602)
      expect(d.pitches.length).toBeLessThanOrEqual(2)
      expect(d.pitches).toEqual([...d.pitches].sort((a, b) => b - a)) // furthest first
      d.pitches.forEach((p) => {
        expect(p).toBeGreaterThanOrEqual(100)
        expect(p).toBeLessThan(RELEASE_DISTANCE)
      })
      if (d.paceChange) {
        expect(d.paceChange.at).toBeGreaterThanOrEqual(80)
        expect(d.paceChange.factor).toBeGreaterThanOrEqual(0.55)
        expect(d.paceChange.factor).toBeLessThanOrEqual(1.6)
      }
    }
  })
})

describe('ballHeight', () => {
  it('touches the ground only where it pitches and at the bat', () => {
    expect(ballHeight(200, [200])).toBe(0)
    expect(ballHeight(0, [200])).toBe(0)
    expect(ballHeight(100, [200])).toBeCloseTo(60) // top of the bounce, half way between pitch and bat
  })
  it('drops from the bowler to the pitch, and bounces once per gap between pitches', () => {
    expect(ballHeight(RELEASE_DISTANCE, [200])).toBe(60)
    expect(ballHeight(290, [200])).toBeGreaterThan(0)
    expect(ballHeight(290, [200])).toBeLessThan(60)
    expect(ballHeight(250, [250, 120])).toBe(0)
    expect(ballHeight(185, [250, 120])).toBeCloseTo(60)
    expect(ballHeight(60, [250, 120])).toBeCloseTo(60)
  })
  it('a full toss never touches the ground on the way in, and reaches the bat at waist height', () => {
    for (let d = 1; d <= RELEASE_DISTANCE; d += 5) expect(ballHeight(d, [])).toBeGreaterThanOrEqual(30)
    expect(ballHeight(0, [])).toBe(30)
    expect(ballHeight(-100, [])).toBe(0)
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
