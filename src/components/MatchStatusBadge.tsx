import { Badge } from '@/components/ui/badge'
import type { MatchStatus } from '@/types/domain'
import { STATUS_LABEL } from '@/utils/matchStatus'

const STYLES: Record<MatchStatus, string> = {
  DRAFT: 'bg-yellow-100 text-yellow-800',
  OPEN: 'bg-green-100 text-green-800',
  FULL: 'bg-orange-100 text-orange-800',
  CLOSED: 'bg-slate-200 text-slate-700',
  COMPLETED: 'bg-blue-100 text-blue-800',
  CANCELLED: 'bg-slate-200 text-slate-500 line-through',
}

export function MatchStatusBadge({ status }: { status: MatchStatus }) {
  return <Badge className={STYLES[status]}>{STATUS_LABEL[status]}</Badge>
}
