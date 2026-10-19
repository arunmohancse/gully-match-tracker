import { AlertCircle, CheckCircle2, ChevronRight, MinusCircle } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useMatches } from '@/hooks/useMatches'
import { useFinancials } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Match, MatchFinancials } from '@/types/domain'
import { formatShortDate, todayISO } from '@/utils/dates'
import { formatINR } from '@/utils/money'
import { isUnopened } from '@/utils/matchStatus'
import { countByFilter, emptyListMessage, filterPaymentMatches, otherMatchesHeading, paymentStatus, pendingSummary, type DateFilter, type PaymentStatus } from '@/utils/paymentsList'

const FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'PAST', label: 'Past' },
]

const PILL = {
  warn: { icon: AlertCircle, className: 'bg-orange-50 text-orange-800' },
  good: { icon: CheckCircle2, className: 'bg-green-50 text-green-800' },
  neutral: { icon: MinusCircle, className: 'bg-slate-100 text-slate-600' },
} as const

function StatusPill({ status }: { status: PaymentStatus }) {
  const { icon: Icon, className } = PILL[status.tone]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium', className)}>
      <Icon className="size-3.5" aria-hidden />
      {status.text}
    </span>
  )
}

function MatchRow({ match, financials, today }: { match: Match; financials: MatchFinancials | undefined; today: string }) {
  const status = paymentStatus(match, financials, today)
  return (
    <li>
      <Link to={`/admin/payments/${match.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{match.title}</div>
          <div className="text-sm text-slate-600">{formatShortDate(match.match_date)}</div>
        </div>
        <div className="flex flex-col items-end gap-0.5">
          <StatusPill status={status} />
          {status.detail && <span className={cn('text-sm font-semibold', status.tone === 'warn' ? 'text-orange-700' : 'text-slate-600')}>{status.detail}</span>}
        </div>
        <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
      </Link>
    </li>
  )
}

/** Pick a match to manage its payments. Matches with money still to chase come first. */
export function PaymentsPage() {
  const { data: matches, isLoading, error, refetch } = useMatches('all')
  const [query, setQuery] = useState('')
  const [when, setWhen] = useState<DateFilter>('ALL')
  const today = todayISO()

  const published = (matches ?? []).filter((m) => !isUnopened(m.status) && m.status !== 'CANCELLED')
  const { data: financials } = useFinancials(published.map((m) => m.id), published.length > 0)
  const byId = new Map((financials ?? []).map((f) => [f.match_id, f]))

  if (isLoading) return <p className="text-slate-500">Loading matches...</p>
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-red-600">
          {toFriendlyMessage(error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const shown = filterPaymentMatches(published, query, when, today, formatShortDate)
  const needs = shown.filter((m) => paymentStatus(m, byId.get(m.id), today).needsFollowUp)
  const others = shown.filter((m) => !paymentStatus(m, byId.get(m.id), today).needsFollowUp)
  const counts = countByFilter(published, query, today, formatShortDate)
  const pending = pendingSummary(published.map((m) => ({ status: paymentStatus(m, byId.get(m.id), today), financials: byId.get(m.id) })))

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>

      {published.length === 0 ? (
        <Card className="text-slate-600">No published matches yet.</Card>
      ) : (
        <>
          {pending.total > 0 && (
            <Card className="flex flex-wrap items-center justify-between gap-2 border-orange-200 bg-orange-50">
              <p className="text-sm text-orange-900">
                <span className="font-semibold">{formatINR(pending.total)}</span> pending across {pending.matches} {pending.matches === 1 ? 'match' : 'matches'}
              </p>
              <Link to="/admin/money" className="text-sm font-medium text-brand underline">
                Money report
              </Link>
            </Card>
          )}
          <Input aria-label="Search matches" placeholder="Search by title or date" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter matches">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={when === f.key ? 'default' : 'outline'} aria-pressed={when === f.key} onClick={() => setWhen(f.key)}>
                {f.label} <span className="opacity-75">{counts[f.key]}</span>
              </Button>
            ))}
          </div>

          {shown.length === 0 && <p className="text-slate-500">{emptyListMessage(when, query)}</p>}

          {needs.length > 0 && (
            <Card className="space-y-1 p-0">
              <h2 className="px-3 pt-3 font-semibold">Needs follow-up ({needs.length})</h2>
              <ul className="divide-y divide-slate-100">
                {needs.map((m) => (
                  <MatchRow key={m.id} match={m} financials={byId.get(m.id)} today={today} />
                ))}
              </ul>
            </Card>
          )}

          {needs.length === 0 && others.length > 0 && <p className="text-sm text-green-700">Nothing needs follow-up here.</p>}

          {others.length > 0 && (
            <Card className="p-0">
              {/* Open by default; keyed on the filter so changing it always shows the new list. */}
              <details key={when} open>
                <summary className="cursor-pointer px-3 py-3 font-semibold">{otherMatchesHeading(when, needs.length > 0)} ({others.length})</summary>
                <ul className="divide-y divide-slate-100 border-t border-slate-100">
                  {others.map((m) => (
                    <MatchRow key={m.id} match={m} financials={byId.get(m.id)} today={today} />
                  ))}
                </ul>
              </details>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
