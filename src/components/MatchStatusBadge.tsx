import { Badge } from '@/components/ui/badge'
import type { Match } from '@/types/domain'
import { STATUS_LABEL } from '@/utils/matchStatus'
import { opensOnDay } from '@/utils/registration'

const STYLES: Record<Match['status'], string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  UPCOMING: 'bg-sky-100 text-sky-800',
  OPEN: 'bg-green-100 text-green-800',
  FULL: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-slate-200 text-slate-700',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-slate-200 text-slate-500 line-through',
}

/** A published match whose registration has not opened yet shows "Registration not open yet" instead of "Registration open". The opening day is shown inside the match. */
export function MatchStatusBadge({ match }: { match: Pick<Match, 'status' | 'registration_opens_at' | 'registration_closes_at'> }) {
  if (opensOnDay(match)) return <Badge className={STYLES.UPCOMING}>{STATUS_LABEL.UPCOMING}</Badge>
  return <Badge className={STYLES[match.status]}>{STATUS_LABEL[match.status]}</Badge>
}
