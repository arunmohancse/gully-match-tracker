/** Rules of the Gully Dash mini game. Pure, so they can be tested without a canvas. */

/** Deliveries at the same gentle pace before the bowler starts mixing it up (one over). */
export const STEADY_BALLS = 6

/** Everything about one ball from the bowler. */
export interface Delivery {
  /** Speed in px/s towards the bat when it leaves the bowler. */
  speed: number
  /** Where the ball pitches (touches the ground), as px before the bat's sweet spot, furthest first. Empty = a full toss. */
  pitches: number[]
  /** Optional change of pace: once the ball is closer than `at` px from the bat's sweet spot, its speed is multiplied by `factor`. */
  paceChange: { at: number; factor: number } | null
  /** Seconds the bowler takes before this ball appears. */
  wait: number
}

/** Ball speed in px/s for the nth delivery (0-based). */
export function deliverySpeed(n: number, rand: () => number = Math.random): number {
  if (n < STEADY_BALLS) return 220
  const base = Math.min(430, 250 + (n - STEADY_BALLS) * 10)
  return Math.round(base * (0.6 + rand() * 0.8)) // 60% to 140% of the base: some are lazy, some are rockets
}

/** Distance in px from the bowler's end to the bat's sweet spot. */
export const RELEASE_DISTANCE = 380
const ARC_HEIGHT = 60 // how high the ball bounces after pitching
const RELEASE_HEIGHT = 60 // height of the ball as it leaves the bowler
const FULL_TOSS_HEIGHT = 30 // a full toss reaches the bat at waist height

/**
 * Height in px above the ground of a ball `d` px before the bat's sweet spot (negative = already past the bat).
 * It drops from the bowler's hand to its first pitch, then bounces in one arc between pitches and the bat.
 * With no pitches (a full toss) it never touches the ground.
 */
export function ballHeight(d: number, pitches: number[]): number {
  if (pitches.length === 0) {
    if (d <= 0) return Math.max(0, FULL_TOSS_HEIGHT + d * 0.6) // falls away once it is past the bat
    return FULL_TOSS_HEIGHT + (RELEASE_HEIGHT - FULL_TOSS_HEIGHT) * Math.min(1, d / RELEASE_DISTANCE)
  }
  if (d <= 0) return 0
  if (d >= pitches[0]) return RELEASE_HEIGHT * Math.min(1, (d - pitches[0]) / (RELEASE_DISTANCE - pitches[0]))
  const contacts = [...pitches, 0]
  for (let i = 0; i < contacts.length - 1; i++) {
    if (d < contacts[i] && d >= contacts[i + 1]) {
      return ARC_HEIGHT * Math.sin((Math.PI * (contacts[i] - d)) / (contacts[i] - contacts[i + 1]))
    }
  }
  return 0
}

/**
 * One delivery. The first over is a steady pace with a normal single pitch so players find their timing;
 * after that nothing can be predicted: speed, where it pitches (or a full toss, or the odd double pitch), a change of pace in flight,
 * and the wait before the ball. Everything gets harder the longer you last, so only the best players keep scoring.
 * `rand` returns [0, 1) and is injectable for tests.
 */
export function makeDelivery(n: number, rand: () => number = Math.random): Delivery {
  const single = () => [Math.round(150 + rand() * 120)]
  if (n < STEADY_BALLS) return { speed: 220, pitches: single(), paceChange: null, wait: 0.4 }

  const kind = rand()
  const pitches = kind < 0.15 ? [] : kind < 0.25 ? [Math.round(230 + rand() * 60), Math.round(100 + rand() * 60)] : single()
  const chance = Math.min(0.6, 0.15 + (n - STEADY_BALLS) * 0.03)
  const paceChange = rand() < chance ? { at: Math.round(80 + rand() * 180), factor: 0.55 + rand() * 1.05 } : null // 0.55x to 1.6x
  return { speed: deliverySpeed(n, rand), pitches, paceChange, wait: 0.3 + rand() * 0.9 }
}

/** Half-width in px of the zone around the sweet spot where a swing connects. Shrinks to a floor. */
export function hitWindow(n: number): number {
  return Math.max(13, 38 - n * 0.9)
}

/** Runs for a swing at `offset` px from the sweet spot, or null if it is outside the window (a miss). */
export function runsForTiming(offset: number, window: number): number | null {
  const ratio = Math.abs(offset) / window
  if (ratio > 1) return null
  if (ratio <= 0.2) return 6
  if (ratio <= 0.5) return 4
  if (ratio <= 0.8) return 2
  return 1
}

const BEST_KEY = 'gully-dash-best'

/** Best score is kept on the device only. Storage can be blocked (private mode), so never throw. */
export function loadBest(): number {
  try {
    const n = Number(localStorage.getItem(BEST_KEY))
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
  } catch {
    return 0
  }
}

export function saveBest(score: number): void {
  try {
    localStorage.setItem(BEST_KEY, String(score))
  } catch {
    /* ignore */
  }
}
