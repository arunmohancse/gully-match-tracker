import type { ListType, Match, RegistrationWithMatch } from '@/types/domain'

export type RegistrationWindow = 'OPEN' | 'NOT_YET' | 'CLOSED'

/**
 * UX hint only. The database decides (it also checks that the match has not started, in the
 * community timezone). This avoids showing a Register button that can never work.
 */
export function registrationWindow(
  match: Pick<Match, 'status' | 'registration_opens_at' | 'registration_closes_at'>,
  now: Date = new Date(),
): RegistrationWindow {
  if (match.status !== 'OPEN' && match.status !== 'FULL') return 'CLOSED'
  if (match.registration_opens_at && now < new Date(match.registration_opens_at)) return 'NOT_YET'
  if (match.registration_closes_at && now >= new Date(match.registration_closes_at)) return 'CLOSED'
  return 'OPEN'
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
