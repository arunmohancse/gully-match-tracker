import { Link } from 'react-router-dom'
import { MatchCard } from '@/components/MatchCard'
import { Button } from '@/components/ui/button'
import { useMatches } from '@/hooks/useMatches'
import { useFinancials } from '@/hooks/usePayments'
import { useMatchCounts } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import type { MatchScope } from '@/services/matchService'

interface Props {
  scope: MatchScope
  /** Base path for match links, e.g. "/matches" or "/admin/matches". */
  basePath: string
  actionLabel: string
  emptyText: string
  /** Hide cancelled matches (used for "upcoming" player views). */
  hideCancelled?: boolean
  /** Admin views: show paid / unpaid / collected on each card. */
  showPayments?: boolean
  /** Admin views: adds a Copy button that opens this create-match path with ?copy=<match id>. */
  copyPath?: string
}

export function MatchList({ scope, basePath, actionLabel, emptyText, hideCancelled, showPayments, copyPath }: Props) {
  const { data, isLoading, error, refetch } = useMatches(scope)
  const { data: counts } = useMatchCounts((data ?? []).map((m) => m.id))
  const countsById = new Map((counts ?? []).map((c) => [c.match_id, c]))
  const { data: financials } = useFinancials((data ?? []).map((m) => m.id), !!showPayments)
  const financialsById = new Map((financials ?? []).map((f) => [f.match_id, f]))

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

  const matches = (data ?? []).filter((m) => !(hideCancelled && m.status === 'CANCELLED'))
  if (matches.length === 0) return <p className="text-slate-500">{emptyText}</p>

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {matches.map((m) => (
        <MatchCard
          key={m.id}
          match={m}
          counts={countsById.get(m.id)}
          financials={financialsById.get(m.id)}
          to={`${basePath}/${m.id}`}
          action={
            <div className="flex gap-2">
              <Button asChild size="sm" variant="outline">
                <Link to={`${basePath}/${m.id}`}>{actionLabel}</Link>
              </Button>
              {copyPath && (
                <Button asChild size="sm" variant="outline">
                  <Link to={`${copyPath}?copy=${m.id}`}>Copy</Link>
                </Button>
              )}
            </div>
          }
        />
      ))}
    </div>
  )
}
