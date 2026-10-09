import { CalendarDays, Clock, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { MatchStatusBadge } from '@/components/MatchStatusBadge'
import type { Match, MatchCounts, MatchFinancials } from '@/types/domain'
import { formatShortDate, formatTime } from '@/utils/dates'
import { isShared, showPaymentLine } from '@/utils/cost'
import { formatINR } from '@/utils/money'

/** Compact match summary. `action` is rendered at the bottom (e.g. a Link-styled button). */
export function MatchCard({
  match,
  to,
  action,
  counts,
  financials,
}: {
  match: Match
  to: string
  action?: ReactNode
  counts?: MatchCounts
  financials?: MatchFinancials
}) {
  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-2">
        <Link to={to} className="text-lg font-semibold hover:underline">
          {match.title}
        </Link>
        <MatchStatusBadge status={match.status} />
      </div>
      <dl className="space-y-1 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <CalendarDays className="size-4" aria-hidden />
          <dt className="sr-only">Date</dt>
          <dd>{formatShortDate(match.match_date)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <Clock className="size-4" aria-hidden />
          <dt className="sr-only">Time</dt>
          <dd>{formatTime(match.start_time)}</dd>
        </div>
        <div className="flex items-center gap-2">
          <MapPin className="size-4" aria-hidden />
          <dt className="sr-only">Venue</dt>
          <dd>{match.venue}</dd>
        </div>
      </dl>
      {showPaymentLine(match, financials) && financials && (
        <p className="text-sm">
          <span className="font-medium text-green-700">{financials.paid_count} paid</span>
          {' · '}
          <span className="font-medium text-red-700">{financials.unpaid_count} unpaid</span>
          {' · '}
          <span className="text-slate-600">{formatINR(financials.collected)} collected</span>
        </p>
      )}
      {financials && financials.expenses_total > 0 && (
        <p className="text-sm text-slate-600">
          Expenses {formatINR(financials.expenses_total)} · Balance{' '}
          <span className={financials.balance < 0 ? 'font-medium text-red-700' : 'font-medium text-green-700'}>{formatINR(financials.balance)}</span>
        </p>
      )}
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="text-slate-600">
          {counts ? `${counts.main_count} / ${match.max_players} registered` : `Max ${match.max_players} players`}
          {counts && counts.waiting_count > 0 && ` · ${counts.waiting_count} waiting`}
          {isShared(match) ? ' · Cost shared' : match.registration_fee > 0 && ` · ${formatINR(match.registration_fee)}`}
        </span>
        {action}
      </div>
    </Card>
  )
}
