const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function parseDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number)
  return { y, m, d }
}

/** "2026-10-18" -> "18 October 2026" (no timezone conversion). */
export function formatMatchDate(iso: string): string {
  const { y, m, d } = parseDate(iso)
  return `${d} ${MONTHS[m - 1]} ${y}`
}

/** "2026-10-18" -> "18 Oct 2026" */
export function formatShortDate(iso: string): string {
  const { y, m, d } = parseDate(iso)
  return `${d} ${MONTHS[m - 1].slice(0, 3)} ${y}`
}

/** "06:00:00" -> "6:00 AM" */
export function formatTime(time: string): string {
  const [h, m] = time.split(':').map(Number)
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}

/** ISO timestamp -> local clock time, e.g. "10:12 AM". */
export function formatClock(iso: string): string {
  const d = new Date(iso)
  return `${d.getHours() % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${d.getHours() >= 12 ? 'PM' : 'AM'}`
}

/** Local calendar date as YYYY-MM-DD. */
export function todayISO(now: Date = new Date()): string {
  const mm = String(now.getMonth() + 1).padStart(2, '0')
  const dd = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${mm}-${dd}`
}

/** Local calendar date `days` days before `now`, as YYYY-MM-DD. */
export function daysAgoISO(days: number, now: Date = new Date()): string {
  return todayISO(new Date(now.getFullYear(), now.getMonth(), now.getDate() - days))
}

/** A YYYY-MM-DD date moved by `days` (negative = earlier), as YYYY-MM-DD. Works across month and year ends. */
export function addDaysISO(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  return todayISO(new Date(y, m - 1, d + days))
}

/** ISO timestamp -> value for <input type="datetime-local"> in local time. */
export function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** <input type="datetime-local"> value (local time) -> ISO timestamp, or null when empty. */
export function fromLocalInput(value: string): string | null {
  return value ? new Date(value).toISOString() : null
}
