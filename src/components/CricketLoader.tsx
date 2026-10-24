import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

const LINES = ['Padding up…', 'Taking guard…', 'Rolling the pitch…', 'Tossing the coin…', 'Setting the field…', 'Walking out to bat…', 'Checking the scorebook…']

/** A cricket ball with a turning seam. Positioned by its parent. */
function Ball({ className }: { className?: string }) {
  return (
    <g className={className}>
      <g className="cl-spin">
        <circle cx="0" cy="0" r="6" />
        <path d="M-2 -5.6 C1 -2 1 2 -2 5.6" fill="none" stroke="#fff" strokeWidth="1" strokeDasharray="1.2 1.2" opacity="0.9" />
      </g>
    </g>
  )
}

/**
 * The delivery: ball pitches and knocks the bails off. Keep in step with the boot screen in index.html.
 * Drawn in a 140 x 64 box.
 */
export function Delivery({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 140 64" className={className} aria-hidden>
      <line className="cl-ground" x1="4" y1="58.5" x2="136" y2="58.5" strokeWidth="1.5" strokeLinecap="round" />
      <ellipse className="cl-shadow" cx="0" cy="58" rx="6" ry="1.6" />
      <rect className="cl-wood" x="112" y="24" width="3.5" height="34" rx="1.2" />
      <rect className="cl-wood" x="118.5" y="24" width="3.5" height="34" rx="1.2" />
      <rect className="cl-wood" x="125" y="24" width="3.5" height="34" rx="1.2" />
      <rect className="cl-wood cl-bail" x="111.5" y="21" width="7.5" height="2.2" rx="1" />
      <rect className="cl-wood cl-bail cl-bail-2" x="120" y="21" width="7.5" height="2.2" rx="1" />
      <Ball className="cl-ball" />
    </svg>
  )
}

/** A new cricket line every 1.6 s (one per delivery), starting at a random one, or the first to carry on from the boot screen. */
function useRotatingLine(fromStart: boolean) {
  const [i, setI] = useState(() => (fromStart ? 0 : Math.floor(Math.random() * LINES.length)))
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % LINES.length), 1600)
    return () => clearInterval(t)
  }, [])
  return LINES[i]
}

/**
 * Loading state with a cricket touch.
 * - default: the delivery plus a rotating cricket line, centred in the page area.
 * - `fullScreen`: the same, filling the screen (app start, login check).
 * - `size="sm"`: a small spinning ball and the label, for inside cards and lists.
 * `label` is what screen readers hear (e.g. "Loading matches"); the cricket lines are decoration.
 */
export function CricketLoader({ label = 'Loading', size = 'md', fullScreen, className }: { label?: string; size?: 'sm' | 'md'; fullScreen?: boolean; className?: string }) {
  if (size === 'sm') {
    return (
      <div role="status" className={cn('cl-root flex items-center gap-2.5 py-2 text-sm font-semibold text-subtle', className)}>
        <svg viewBox="-7 -7 14 14" className="size-4 shrink-0" aria-hidden>
          <Ball className="cl-ball-static" />
        </svg>
        {label}…
      </div>
    )
  }
  return <BigLoader label={label} fullScreen={fullScreen} className={className} />
}

function BigLoader({ label, fullScreen, className }: { label: string; fullScreen?: boolean; className?: string }) {
  const line = useRotatingLine(!!fullScreen)
  return (
    // Full screen takes over from the boot screen in index.html, so it shows at once (no fade-in delay) and looks the same.
    <div
      role="status"
      className={cn('flex flex-col items-center justify-center gap-3 text-center', fullScreen ? 'min-h-screen p-6' : 'cl-root py-14', className)}
    >
      <Delivery className={fullScreen ? 'h-20 w-44' : 'w-36'} />
      <p className="font-display text-xl font-bold tracking-wide text-muted" aria-hidden>
        {line}
      </p>
      <span className="sr-only">{label}</span>
    </div>
  )
}
