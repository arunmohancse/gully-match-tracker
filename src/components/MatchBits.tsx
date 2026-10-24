import { cn } from '@/lib/utils'
import { dateBlockParts } from '@/utils/dates'

/** Calendar-style block: OCT / 25 / SUN. `size="sm"` drops the weekday for list rows. */
export function DateBlock({ date, highlight, size = 'md', className }: { date: string; highlight?: boolean; size?: 'sm' | 'md'; className?: string }) {
  const { day, month, weekday } = dateBlockParts(date)
  return (
    <div
      aria-hidden
      className={cn(
        'flex shrink-0 flex-col items-center justify-center leading-none',
        size === 'md' ? 'w-16 gap-0.5' : 'h-14 w-12 rounded-xl',
        highlight ? 'bg-brand text-brand-foreground' : size === 'md' ? 'bg-brand/10 text-brand' : 'bg-surface-3 text-fg',
        className,
      )}
    >
      {size === 'md' && <span className="text-[11px] font-extrabold tracking-wider">{month}</span>}
      <span className={cn('font-display font-bold', size === 'md' ? 'text-3xl' : 'text-[22px]')}>{day}</span>
      <span className={cn('text-[10px] font-bold tracking-wider', size === 'sm' && !highlight && 'text-subtle')}>{size === 'md' ? weekday : month}</span>
    </div>
  )
}

/** "19 / 22 registered · 2 waiting" with a fill bar. `onPitch` styles it for the striped hero card. */
export function SlotsBar({ registered, max, waiting = 0, onPitch }: { registered: number; max: number; waiting?: number; onPitch?: boolean }) {
  const pct = max > 0 ? Math.min(100, Math.round((registered / max) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <p className={cn('flex justify-between gap-2 text-sm font-semibold', onPitch ? 'text-on-pitch-muted' : 'text-muted')}>
        <span>
          <span className={cn('font-bold', onPitch ? 'text-on-pitch' : 'text-fg')}>
            {registered} / {max}
          </span>{' '}
          registered
        </span>
        {waiting > 0 ? <span>{waiting} waiting</span> : registered < max && registered > 0 && <span>{max - registered} left</span>}
      </p>
      <div className={cn('h-2 overflow-hidden rounded-full', onPitch ? 'bg-pitch-track' : 'bg-surface-3')} aria-hidden>
        <div className={cn('h-full rounded-full', onPitch ? 'bg-stumps' : 'bg-brand')} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}
