import { Link } from 'react-router-dom'
import { PlayerPaymentInfo } from '@/components/PlayerPaymentInfo'
import { CancelledBadge, ListBadge } from '@/components/RegistrationBadges'
import { Card } from '@/components/ui/card'
import type { RegistrationWithMatch } from '@/types/domain'
import { formatShortDate, formatTime } from '@/utils/dates'

/** One of the player's registrations with its match, list position and payment status. */
export function RegistrationItem({ registration: r }: { registration: RegistrationWithMatch }) {
  const active = r.status === 'ACTIVE'
  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <Link to={`/matches/${r.match.id}`} className="font-semibold hover:underline">
          {r.match.title}
        </Link>
        {active ? <ListBadge listType={r.list_type} position={r.list_position} /> : <CancelledBadge />}
      </div>
      <p className="text-sm text-slate-600">
        {formatShortDate(r.match.match_date)} · {formatTime(r.match.start_time)} · {r.match.venue}
      </p>
      {r.match.status === 'CANCELLED' && <p className="text-sm text-slate-500">This match was cancelled.</p>}
      <PlayerPaymentInfo match={r.match} reg={r} variant="compact" />
    </Card>
  )
}
