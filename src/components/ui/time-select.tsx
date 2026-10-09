import { joinTime, splitTime, type TimeParts } from '@/utils/timeParts'

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1))
const STEP_MINUTES = Array.from({ length: 12 }, (_, i) => String(i * 5).padStart(2, '0'))

const selectClass = 'h-11 w-full rounded-md border border-slate-300 bg-white px-2 text-base focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50'

interface Props {
  /** Id of the hour dropdown, so a <label htmlFor> points at it. */
  id: string
  /** "HH:MM" in 24-hour time, or '' for no time. */
  value: string
  onChange: (value: string) => void
  /** Adds a blank choice so the time can be cleared. */
  optional?: boolean
}

/** Hour / minute (5-minute steps) / AM-PM dropdowns. Easier on a phone than the browser's time spinner. */
export function TimeSelect({ id, value, onChange, optional }: Props) {
  const parts = splitTime(value)
  // Keep an odd minute (for example 07 from an older match) selectable instead of silently changing it.
  const minutes = STEP_MINUTES.includes(parts.minute) ? STEP_MINUTES : [...STEP_MINUTES, parts.minute].sort()
  const update = (patch: Partial<TimeParts>) => onChange(joinTime({ ...parts, ...patch }))

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr] gap-2">
      <select id={id} className={selectClass} value={parts.hour} onChange={(e) => update({ hour: e.target.value })} aria-label="Hour">
        {(optional || !parts.hour) && <option value="">{optional ? '--' : 'Hour'}</option>}
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <select className={selectClass} value={parts.minute} onChange={(e) => update({ minute: e.target.value })} disabled={!parts.hour} aria-label="Minutes">
        {minutes.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
      <select className={selectClass} value={parts.period} onChange={(e) => update({ period: e.target.value as 'AM' | 'PM' })} disabled={!parts.hour} aria-label="AM or PM">
        <option value="AM">AM</option>
        <option value="PM">PM</option>
      </select>
    </div>
  )
}
