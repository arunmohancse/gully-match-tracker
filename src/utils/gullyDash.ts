/** Rules of the Gully Dash mini game. Pure, so they can be tested without a canvas. */

/** Ball speed in px/s for the nth delivery (0-based). Starts gentle and caps so it stays humanly possible. */
export function deliverySpeed(n: number): number {
  return Math.min(400, 220 + n * 12)
}

/** Half-width in px of the zone around the sweet spot where a swing connects. Shrinks to a floor. */
export function hitWindow(n: number): number {
  return Math.max(22, 38 - n)
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
