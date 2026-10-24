import { Badge } from '@/components/ui/badge'
import type { Match } from '@/types/domain'
import { matchStatusLabel } from '@/utils/matchStatus'
import { opensOnDay } from '@/utils/registration'

const STYLES: Record<Match['status'], string> = {
  DRAFT: 'bg-warning-tint text-warning',
  UPCOMING: 'bg-info-soft text-info',
  OPEN: 'bg-success-tint text-success',
  FULL: 'bg-warning-tint text-warning',
  CLOSED: 'bg-surface-4 text-fg-2',
  COMPLETED: 'bg-info-soft text-info',
  CANCELLED: 'bg-surface-4 text-subtle line-through',
}

type StatusFields = Pick<Match, 'status' | 'registration_opens_at' | 'registration_closes_at'>

/** "Registration not open yet" until the opening day; the opening day itself is shown inside the match. */
export function MatchStatusBadge({ match }: { match: StatusFields }) {
  const status = opensOnDay(match) ? 'UPCOMING' : match.status
  return <Badge className={STYLES[status]}>{matchStatusLabel(match)}</Badge>
}
