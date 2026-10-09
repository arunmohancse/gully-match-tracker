import { ChevronRight } from 'lucide-react'
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
import { filterPaymentMatches, paymentStatus, type DateFilter } from '@/utils/paymentsList'

const FILTERS: { key: DateFilter; label: string }[] = [
  { key: 'ALL', label: 'All' },
  { key: 'UPCOMING', label: 'Upcoming' },
  { key: 'PAST', label: 'Past' },
]

function MatchRow({ match, financials, today }: { match: Match; financials: MatchFinancials | undefined; today: string }) {
  const status = paymentStatus(match, financials, today)
  return (
    <li>
      <Link to={`/admin/payments/${match.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50">
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{match.title}</div>
          <div className="text-sm text-slate-600">{formatShortDate(match.match_date)}</div>
        </div>
        <span className={cn('text-right text-sm font-medium', status.tone === 'warn' && 'text-orange-700', status.tone === 'good' && 'text-green-700', status.tone === 'neutral' && 'text-slate-500')}>
          {status.text}
        </span>
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

  const published = (matches ?? []).filter((m) => m.status !== 'DRAFT' && m.status !== 'CANCELLED')
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

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Payments</h1>

      {published.length === 0 ? (
        <Card className="text-slate-600">No published matches yet.</Card>
      ) : (
        <>
          <Input aria-label="Search matches" placeholder="Search by title or date" value={query} onChange={(e) => setQuery(e.target.value)} />
          <div className="flex flex-wrap gap-2" role="group" aria-label="Filter matches">
            {FILTERS.map((f) => (
              <Button key={f.key} size="sm" variant={when === f.key ? 'default' : 'outline'} aria-pressed={when === f.key} onClick={() => setWhen(f.key)}>
                {f.label}
              </Button>
            ))}
          </div>

          {shown.length === 0 && <p className="text-slate-500">No matches found.</p>}

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

          {others.length > 0 && (
            <Card className="p-0">
              <details open={needs.length === 0 || query.trim() !== ''}>
                <summary className="cursor-pointer px-3 py-3 font-semibold">{needs.length === 0 ? 'Matches' : 'Settled, free and upcoming'} ({others.length})</summary>
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
