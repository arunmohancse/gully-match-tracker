import type { ListType, Match, RegistrationWithMatch } from '@/types/domain'
import { formatClock, formatShortDate, formatWeekday, toLocalInput } from './dates'

export type RegistrationWindow = 'OPEN' | 'NOT_YET' | 'CLOSED'

/**
 * UX hint only. The database decides (it also checks that the match has not started, in the
 * community timezone). This avoids showing a Register button that can never work.
 */
export function registrationWindow(
  match: Pick<Match, 'status' | 'registration_opens_at' | 'registration_closes_at'>,
  now: Date = new Date(),
): RegistrationWindow {
  if (match.status === 'UPCOMING') return 'NOT_YET'
  if (match.status !== 'OPEN' && match.status !== 'FULL') return 'CLOSED'
  if (match.registration_opens_at && now < new Date(match.registration_opens_at)) return 'NOT_YET'
  if (match.registration_closes_at && now >= new Date(match.registration_closes_at)) return 'CLOSED'
  return 'OPEN'
}

/** True when the registration opening day is still ahead, whatever the match status (a draft included). */
export function opensLater(match: Pick<Match, 'registration_opens_at'>, now: Date = new Date()): boolean {
  return !!match.registration_opens_at && now < new Date(match.registration_opens_at)
}

/**
 * The day registration opens, e.g. "20 Oct 2026", while a published match is still waiting for it. Otherwise null.
 * An admin publishes a match with a future opening day; the database refuses early registrations until then.
 */
export function opensOnDay(
  match: Pick<Match, 'status' | 'registration_opens_at' | 'registration_closes_at'>,
  now: Date = new Date(),
): string | null {
  if (match.status === 'UPCOMING' || registrationWindow(match, now) !== 'NOT_YET' || !match.registration_opens_at) return null
  const day = toLocalInput(match.registration_opens_at).slice(0, 10)
  return `${formatShortDate(day)} (${formatWeekday(day)}) at ${formatClock(match.registration_opens_at)}`
}

/** Splits a player's registrations into upcoming active ones and history. */
export function splitRegistrations(regs: RegistrationWithMatch[], today: string) {
  const upcoming: RegistrationWithMatch[] = []
  const history: RegistrationWithMatch[] = []
  for (const r of regs) {
    const live =
      r.status === 'ACTIVE' && r.match.match_date >= today && r.match.status !== 'CANCELLED' && r.match.status !== 'COMPLETED'
    if (live) upcoming.push(r)
    else history.push(r)
  }
  const when = (r: RegistrationWithMatch) => r.match.match_date + r.match.start_time
  upcoming.sort((a, b) => when(a).localeCompare(when(b)))
  return { upcoming, history }
}

export function listLabel(listType: ListType, position: number | null): string {
  const name = listType === 'MAIN_LIST' ? 'Main list' : 'Waiting list'
  return position ? `${name} #${position}` : name
}
