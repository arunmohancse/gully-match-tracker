import { ChevronRight, Clock, MapPin } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Card } from '@/components/ui/card'
import { DateBlock, SlotsBar } from '@/components/MatchBits'
import { MatchStatusBadge } from '@/components/MatchStatusBadge'
import type { Match, MatchCounts, MatchFinancials } from '@/types/domain'
import { formatTime } from '@/utils/dates'
import { isShared, showPaymentLine } from '@/utils/cost'
import { formatINR } from '@/utils/money'

/** Match summary: date block on the left, details and `action` (buttons) on the right. */
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
    <Card className="flex overflow-hidden p-0">
      <DateBlock date={match.match_date} />
      <div className="min-w-0 flex-1 space-y-3 p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 space-y-1">
            <Link to={to} className="block font-bold leading-snug hover:underline">
              {match.title}
            </Link>
            <dl className="space-y-0.5 text-sm text-muted">
              <div className="flex items-center gap-1.5">
                <Clock className="size-3.5 shrink-0" aria-hidden />
                <dt className="sr-only">Time</dt>
                <dd>{formatTime(match.start_time)}</dd>
              </div>
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" aria-hidden />
                <dt className="sr-only">Venue</dt>
                <dd className="truncate">{match.venue}</dd>
              </div>
            </dl>
          </div>
          <MatchStatusBadge match={match} />
        </div>

        {counts ? (
          <SlotsBar registered={counts.main_count} max={match.max_players} waiting={counts.waiting_count} />
        ) : (
          <p className="text-sm text-muted">Max {match.max_players} players</p>
        )}

        <div className="space-y-0.5 text-sm text-muted">
          {showPaymentLine(match, financials) && financials && (
            <p>
              <span className="font-semibold text-success">{financials.paid_count} paid</span>
              {' · '}
              <span className="font-semibold text-danger">{financials.unpaid_count} unpaid</span>
              {' · '}
              {formatINR(financials.collected)} collected
            </p>
          )}
          {financials && financials.expenses_total > 0 && (
            <p>
              Expenses {formatINR(financials.expenses_total)} · Balance{' '}
              <span className={financials.balance < 0 ? 'font-semibold text-danger' : 'font-semibold text-success'}>{formatINR(financials.balance)}</span>
            </p>
          )}
          {isShared(match) ? <p>Cost shared after the match</p> : match.registration_fee > 0 && <p>Fee {formatINR(match.registration_fee)}</p>}
        </div>

        {action}
      </div>
    </Card>
  )
}

/** One-line match row for the dashboard: date, time and venue, status. The whole row opens the match. */
export function MatchRow({ match, to, counts }: { match: Match; to: string; counts?: MatchCounts }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-brand"
    >
      <DateBlock date={match.match_date} size="sm" />
      <span className="min-w-0 flex-1 space-y-0.5">
        <span className="block truncate font-bold">{match.title}</span>
        <span className="block truncate text-sm text-muted">
          {formatTime(match.start_time)} · {match.venue}
          {counts && ` · ${counts.main_count}/${match.max_players}`}
        </span>
        <MatchStatusBadge match={match} />
      </span>
      <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
    </Link>
  )
}
