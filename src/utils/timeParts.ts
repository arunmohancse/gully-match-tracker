export interface TimeParts {
  hour: string // '1'..'12', or '' when no time is chosen
  minute: string // '00'..'59'
  period: 'AM' | 'PM'
}

/** "18:30" -> { hour: '6', minute: '30', period: 'PM' }. Empty or invalid input gives an empty time. */
export function splitTime(value: string): TimeParts {
  const m = /^(\d{2}):(\d{2})/.exec(value)
  if (!m) return { hour: '', minute: '00', period: 'AM' }
  const h24 = Number(m[1])
  return { hour: String(h24 % 12 === 0 ? 12 : h24 % 12), minute: m[2], period: h24 >= 12 ? 'PM' : 'AM' }
}

/** Inverse of splitTime: gives "HH:MM" (24-hour), or '' when no hour is chosen. */
export function joinTime({ hour, minute, period }: TimeParts): string {
  if (!hour) return ''
  const h = Number(hour) % 12
  return `${String((period === 'PM' ? h + 12 : h)).padStart(2, '0')}:${minute}`
}
