import { brand } from '@/config/brand'
import type { Match } from '@/types/domain'
import { formatMatchDate, formatTime } from './dates'
import { isShared } from './cost'
import { formatINR } from './money'
import { opensOnDay } from './registration'

const REGISTRATION_LINE: Record<Match['status'], string> = {
  DRAFT: 'Registration is not open yet.',
  UPCOMING: 'Registration is not open yet. We will share a message when it opens.',
  OPEN: 'Registration is now open.',
  FULL: 'Main list is full. New registrations go to the waiting list.',
  CLOSED: 'Registration is closed.',
  COMPLETED: 'This match has been completed.',
  CANCELLED: 'This match has been cancelled.',
}

/**
 * Shareable plain-text announcement (e.g. for WhatsApp). The match link comes first so WhatsApp previews it;
 * the community invite goes last.
 */
export function buildAnnouncement(match: Match, url: string, communityUrl: string = brand.whatsappCommunity): string {
  const opensOn = opensOnDay(match)
  const time = match.end_time ? `${formatTime(match.start_time)} - ${formatTime(match.end_time)}` : formatTime(match.start_time)
  return [
    `*${match.title.toUpperCase()}*`,
    '',
    `Date: ${formatMatchDate(match.match_date)}`,
    `Time: ${time}`,
    `Venue: ${match.venue}`,
    '',
    ...(!isShared(match) && match.registration_fee > 0 ? [`Match Fee: ${formatINR(match.registration_fee)}`] : []),
    `Maximum Players: ${match.max_players}`,
    '',
    opensOn ? `Registration opens on ${opensOn}.` : REGISTRATION_LINE[match.status],
    'Register here:',
    url,
    ...(communityUrl ? ['', 'New here? Join our WhatsApp community:', communityUrl] : []),
  ].join('\n')
}
