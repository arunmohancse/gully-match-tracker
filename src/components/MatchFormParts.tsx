import { CalendarPlus, Check, Clock, Minus, Plus, Split, Ticket, type LucideIcon } from 'lucide-react'
import { useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { addDaysISO, dateBlockParts, formatTime, todayISO } from '@/utils/dates'
import type { CostModel } from '@/types/domain'

/** One card of the form: icon tile, heading, optional note on the right. */
export function FormSection({ icon: Icon, title, aside, children, className }: { icon: LucideIcon; title: ReactNode; aside?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('space-y-4 rounded-[20px] border border-line bg-surface p-4', className)}>
      <div className="flex items-center gap-2.5">
        <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-brand/12 text-brand" aria-hidden>
          <Icon className="size-[18px]" />
        </span>
        <h2 className="flex-1 text-[17px] font-extrabold">{title}</h2>
        {aside && <span className="text-xs font-semibold text-subtle">{aside}</span>}
      </div>
      {children}
    </section>
  )
}

export function FieldError({ children }: { children?: string }) {
  if (!children) return null
  return (
    <p role="alert" className="text-sm text-danger">
      {children}
    </p>
  )
}

/** " · optional" after a field label. */
export function Optional() {
  return <span className="font-semibold normal-case tracking-normal text-subtle"> · optional</span>
}

const DAYS_SHOWN = 14

/**
 * Tap a day from the next two weeks (a strip that scrolls sideways), or open the calendar for any other. The calendar
 * tile is pinned outside the strip so it is always in view, on a phone and on desktop where the strip has no swipe.
 * A picked day outside the strip shows first.
 */
export function DateStrip({ value, onChange, labelledBy }: { value: string; onChange: (iso: string) => void; labelledBy: string }) {
  const pickerRef = useRef<HTMLInputElement>(null)
  const today = todayISO()
  const days = Array.from({ length: DAYS_SHOWN }, (_, i) => addDaysISO(today, i))
  if (value && !days.includes(value)) days.unshift(value)

  return (
    <div className="flex gap-2">
      <div role="radiogroup" aria-labelledby={labelledBy} className="flex min-w-0 flex-1 snap-x gap-2 overflow-x-auto pb-1 [scrollbar-width:none] md:pb-2 md:[scrollbar-width:thin]">
        {days.map((iso) => {
          const { day, weekday, month } = dateBlockParts(iso)
          const selected = iso === value
          return (
            <button
              key={iso}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${weekday} ${Number(day)} ${month}${iso === today ? ', today' : ''}`}
              onClick={() => onChange(iso)}
              className={cn(
                'flex h-[74px] w-14 shrink-0 snap-start flex-col items-center justify-center gap-0.5 rounded-2xl border leading-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                selected ? 'border-brand bg-brand text-brand-foreground' : 'border-line bg-surface-2 hover:border-line-strong',
              )}
            >
              <span className={cn('text-[11px] font-extrabold', !selected && 'text-muted')}>{iso === today ? 'TODAY' : weekday}</span>
              <span className="font-display text-[26px] font-bold">{Number(day)}</span>
              <span className={cn('text-[10px] font-bold tracking-wider', !selected && 'text-subtle')}>{month}</span>
            </button>
          )
        })}
      </div>
      <span title="Pick another date" className="relative flex h-[74px] w-14 shrink-0 items-center justify-center rounded-2xl border border-dashed border-line-strong text-brand focus-within:outline-2 focus-within:outline-brand">
        <CalendarPlus className="size-[22px]" aria-hidden />
        <input
          ref={pickerRef}
          type="date"
          aria-label="Pick another date"
          value={value}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={() => {
            try {
              pickerRef.current?.showPicker()
            } catch {
              // older browsers open their own picker on tap
            }
          }}
          className="absolute inset-0 size-full cursor-pointer opacity-0"
        />
      </span>
    </div>
  )
}

function splitClock(time: string): { clock: string; period: string } {
  const [clock, period] = formatTime(time).split(' ')
  return { clock, period }
}

/** Big STARTS / ENDS tile that opens the time dropdowns underneath. */
export function TimeTile({ label, value, open, invalid, onToggle, controls }: { label: ReactNode; value: string; open: boolean; invalid?: boolean; onToggle: () => void; controls: string }) {
  const parts = value ? splitClock(value) : null
  return (
    <button
      type="button"
      aria-expanded={open}
      aria-controls={controls}
      onClick={onToggle}
      className={cn(
        'flex flex-col gap-0.5 rounded-2xl border px-3.5 py-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        open ? 'border-brand bg-brand/10' : invalid ? 'border-danger-line bg-danger-soft' : 'border-line bg-surface-2 hover:border-line-strong',
      )}
    >
      <span className="text-[11px] font-extrabold uppercase tracking-[0.1em] text-muted">{label}</span>
      {parts ? (
        <span className="flex items-baseline gap-1">
          <span className="font-display text-[32px] font-bold leading-none">{parts.clock}</span>
          <span className="text-sm font-extrabold">{parts.period}</span>
        </span>
      ) : (
        <span className="flex h-8 items-center text-base font-bold text-subtle">Set time</span>
      )}
    </button>
  )
}

const SQUAD_SIZES = [12, 16, 20, 22]

/** − 22 + counter (still a typeable number) with quick picks for the usual squad sizes. */
export function PlayersStepper({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string }) {
  const n = Number(value)
  const step = (d: number) => onChange(String(Math.max(1, (Number.isFinite(n) ? n : 0) + d)))
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <label htmlFor="maxPlayers" className="block font-extrabold">
            Players
          </label>
          <p className="text-xs text-muted">Extra sign-ups go to the waitlist</p>
        </div>
        <div className={cn('flex items-center rounded-2xl border bg-surface-2', error ? 'border-danger-line' : 'border-line')}>
          <button type="button" aria-label="One less player" onClick={() => step(-1)} disabled={n <= 1} className="grid h-12 w-11 place-items-center rounded-l-2xl hover:bg-surface-3 disabled:opacity-40">
            <Minus className="size-[18px]" aria-hidden />
          </button>
          <input
            id="maxPlayers"
            type="number"
            inputMode="numeric"
            min={1}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="h-12 w-12 bg-transparent text-center font-display text-[30px] font-bold [appearance:textfield] focus-visible:outline-2 focus-visible:outline-brand [&::-webkit-inner-spin-button]:appearance-none"
          />
          <button type="button" aria-label="One more player" onClick={() => step(1)} className="grid h-12 w-11 place-items-center rounded-r-2xl hover:bg-surface-3">
            <Plus className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Common squad sizes">
        {SQUAD_SIZES.map((size) => {
          const on = n === size
          return (
            <button
              key={size}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(String(size))}
              className={cn(
                'h-9 min-w-12 rounded-full border px-3.5 text-sm focus-visible:outline-2 focus-visible:outline-brand',
                on ? 'border-brand bg-brand/12 font-extrabold text-brand' : 'border-line font-bold text-muted hover:text-fg',
              )}
            >
              {size}
            </button>
          )
        })}
      </div>
      <FieldError>{error}</FieldError>
    </div>
  )
}

const COST_OPTIONS: { value: CostModel; icon: LucideIcon; title: string; text: string }[] = [
  { value: 'SHARED_COST', icon: Split, title: 'Split after', text: 'Add the expenses after the match. They are shared equally by the main list.' },
  { value: 'FIXED_FEE', icon: Ticket, title: 'Fixed fee', text: 'Everyone pays the same amount, set now.' },
]

/** Two big radio tiles for how the match is paid. */
export function CostTiles({ value, onChange }: { value: CostModel; onChange: (v: CostModel) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2.5">
      {COST_OPTIONS.map(({ value: v, icon: Icon, title, text }) => {
        const on = v === value
        return (
          <label
            key={v}
            className={cn(
              'relative flex cursor-pointer flex-col gap-2 rounded-2xl p-3.5 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand',
              on ? 'border-2 border-brand bg-brand/10 p-[13px]' : 'border border-line bg-surface-2 hover:border-line-strong',
            )}
          >
            <input type="radio" name="costModel" value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
            <span className={cn('flex items-center justify-between', on ? 'text-brand' : 'text-muted')}>
              <Icon className="size-[22px]" aria-hidden />
              {on ? (
                <span className="grid size-5 place-items-center rounded-full bg-brand text-brand-foreground" aria-hidden>
                  <Check className="size-3" strokeWidth={3.5} />
                </span>
              ) : (
                <span className="size-5 rounded-full border-2 border-line-strong" aria-hidden />
              )}
            </span>
            <span className="text-sm font-extrabold">{title}</span>
            <span className="text-xs leading-snug text-muted">{text}</span>
          </label>
        )
      })}
    </div>
  )
}

/** Small clock line under the time tiles. */
export function TimeNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-semibold text-muted">
      <Clock className="size-[15px] shrink-0" aria-hidden />
      {children}
    </p>
  )
}
