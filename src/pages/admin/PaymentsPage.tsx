import { AlertCircle, CheckCircle2, ChevronRight, MinusCircle, Search } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { DateBlock } from '@/components/MatchBits'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { useMatches } from '@/hooks/useMatches'
import { useFinancials } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import type { Match, MatchFinancials } from '@/types/domain'
import { formatShortDate, todayISO } from '@/utils/dates'
import { formatINR } from '@/utils/money'
import { isUnopened } from '@/utils/matchStatus'
import { countByFilter, emptyListMessage, filterPaymentMatches, otherMatchesHeading, paymentStatus, pendingSummary, type DateFilter, type PaymentStatus } from '@/utils/paymentsList'
import { CricketLoader } from '@/components/CricketLoader'

const FILTERS: { value: DateFilter; label: string }[] = [
  { value: 'ALL', label: 'All' },
  { value: 'UPCOMING', label: 'Upcoming' },
  { value: 'PAST', label: 'Past' },
]

const PILL = {
  warn: { icon: AlertCircle, className: 'bg-warning-tint text-warning' },
  good: { icon: CheckCircle2, className: 'bg-success-tint text-success' },
  neutral: { icon: MinusCircle, className: 'bg-surface-3 text-muted' },
} as const

function StatusPill({ status }: { status: PaymentStatus }) {
  const { icon: Icon, className } = PILL[status.tone]
  return (
    <span className={cn('inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold', className)}>
      <Icon className="size-3.5" aria-hidden />
      {status.text}
    </span>
  )
}

function MatchRow({ match, financials, today }: { match: Match; financials: MatchFinancials | undefined; today: string }) {
  const status = paymentStatus(match, financials, today)
  return (
    <li>
      <Link to={`/admin/payments/${match.id}`} className="flex items-center gap-3 p-3 hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand">
        <DateBlock date={match.match_date} size="sm" />
        <div className="min-w-0 flex-1 space-y-1">
          <div className="truncate font-bold">{match.title}</div>
          <StatusPill status={status} />
        </div>
        {status.detail && <span className={cn('shrink-0 font-display text-lg font-bold', status.tone === 'warn' ? 'text-warning' : 'text-muted')}>{status.detail}</span>}
        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
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

  if (isLoading) return <CricketLoader label="Loading matches" />
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-danger">
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
      <PageHeader title="Payments" />

      {published.length === 0 ? (
        <Card className="text-muted">No published matches yet.</Card>
      ) : (
        <>
          {pending.total > 0 && (
            <section className="flex items-center gap-3 rounded-2xl bg-warning-soft p-4 text-warning">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-extrabold uppercase tracking-wider">Pending</p>
                <p className="font-display text-4xl font-bold leading-none">{formatINR(pending.total)}</p>
                <p className="text-sm font-semibold">
                  across {pending.matches} {pending.matches === 1 ? 'match' : 'matches'}
                </p>
              </div>
              <Link to="/admin/money" className="inline-flex h-10 shrink-0 items-center rounded-full border-2 border-current px-4 text-sm font-extrabold hover:opacity-80">
                Money report
              </Link>
            </section>
          )}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-subtle" aria-hidden />
            <Input type="search" aria-label="Search matches" placeholder="Search by title or date" className="pl-10" value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <Segmented label="Filter matches" value={when} onChange={setWhen} options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} />

          {shown.length === 0 && <p className="text-subtle">{emptyListMessage(when, query)}</p>}

          {needs.length > 0 && (
            <section className="space-y-2">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-subtle">Needs follow-up · {needs.length}</h2>
              <ul className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
                {needs.map((m) => (
                  <MatchRow key={m.id} match={m} financials={byId.get(m.id)} today={today} />
                ))}
              </ul>
            </section>
          )}

          {needs.length === 0 && others.length > 0 && <p className="flex items-center gap-2 text-sm font-semibold text-success">
              <CheckCircle2 className="size-4" aria-hidden /> Nothing needs follow-up here.
            </p>}

          {others.length > 0 && (
            <Card className="p-0">
              {/* Open by default; keyed on the filter so changing it always shows the new list. */}
              <details key={when} open>
                <summary className="cursor-pointer px-4 py-3 text-xs font-extrabold uppercase tracking-wider text-subtle">
                  {otherMatchesHeading(when, needs.length > 0)} · {others.length}
                </summary>
                <ul className="divide-y divide-line border-t border-line">
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
