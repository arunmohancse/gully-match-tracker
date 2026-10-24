import { cn } from '@/lib/utils'

/** One-of-a-few filter (Upcoming / Past / All), drawn as a single pill track. Optional counts show after each label. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { value: T; label: string; count?: number }[]
  value: T
  onChange: (value: T) => void
  /** Accessible name for the group, e.g. "Filter matches". */
  label: string
  className?: string
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('grid gap-1 rounded-xl bg-surface-3 p-1', className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      {options.map((o) => {
        const selected = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(o.value)}
            className={cn(
              'min-h-10 truncate rounded-lg px-2 text-sm transition-colors focus-visible:outline-2 focus-visible:outline-brand',
              selected ? 'bg-surface font-bold text-fg shadow-sm' : 'font-semibold text-subtle hover:text-fg',
            )}
          >
            {o.label}
            {o.count !== undefined && <span className={cn('ml-1.5', selected ? 'text-brand' : 'text-faint')}>{o.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
