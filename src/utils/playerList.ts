import type { AdminRegistration, Match } from '@/types/domain'
import { brand } from '@/config/brand'
import { hasPayments } from './cost'
import { formatMatchDate, formatTime } from './dates'

function numbered(names: string[]): string[] {
  return names.map((name, i) => `${i + 1}. ${name}`)
}

/** Positive call to action that fits the match status (no mention of cancelling). */
function callToAction(status: Match['status']): string {
  if (status === 'OPEN') return 'Register here:'
  if (status === 'FULL') return 'Main list is full. Join the waiting list here:'
  return 'Match details:'
}

/**
 * Plain-text player list for pasting into a WhatsApp group: main list, then waiting list.
 * Cancelled registrations are left out. `url` is the match link, so late joiners can register or cancel.
 */
export function buildPlayerListMessage(match: Match, regs: AdminRegistration[], url: string): string {
  const active = regs.filter((r) => r.status === 'ACTIVE')
  const names = (list: 'MAIN_LIST' | 'WAITING_LIST') =>
    active
      .filter((r) => r.list_type === list)
      .sort((a, b) => (a.list_position ?? 0) - (b.list_position ?? 0))
      .map((r) => r.player?.full_name?.trim() || 'Unknown player')

  const main = names('MAIN_LIST')
  const waiting = names('WAITING_LIST')
  const time = match.end_time ? `${formatTime(match.start_time)} - ${formatTime(match.end_time)}` : formatTime(match.start_time)
  const spotsLeft = Math.max(match.max_players - main.length, 0)

  return [
    `*${match.title.toUpperCase()}*`,
    `${formatMatchDate(match.match_date)}, ${time}`,
    `Venue: ${match.venue}`,
    '',
    `*Main list (${main.length}/${match.max_players})*`,
    ...(main.length ? numbered(main) : ['No players yet']),
    ...(waiting.length ? ['', `*Waiting list (${waiting.length})*`, ...numbered(waiting)] : []),
    '',
    ...(spotsLeft > 0 && match.status === 'OPEN' ? [`${spotsLeft} spot${spotsLeft === 1 ? '' : 's'} left.`] : []),
    ...(brand.registrationNote && hasPayments(match) ? [`Note: ${brand.registrationNote}`, ''] : []),
    callToAction(match.status),
    url,
  ].join('\n')
}
