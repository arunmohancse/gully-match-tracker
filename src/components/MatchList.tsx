import { CopyPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MatchCard, MatchRow } from '@/components/MatchCard'
import { Button } from '@/components/ui/button'
import { useMatches } from '@/hooks/useMatches'
import { useFinancials } from '@/hooks/usePayments'
import { useMatchCounts } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import type { MatchScope } from '@/services/matchService'
import { CricketLoader } from '@/components/CricketLoader'

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
  /** "row": compact one-line rows (dashboard). Default: full cards. */
  variant?: 'card' | 'row'
  /** Leave out the first N matches, e.g. the one already shown in the "Next match" card. */
  skip?: number
}

export function MatchList({ scope, basePath, actionLabel, emptyText, hideCancelled, showPayments, copyPath, variant = 'card', skip = 0 }: Props) {
  const { data, isLoading, error, refetch } = useMatches(scope)
  const { data: counts } = useMatchCounts((data ?? []).map((m) => m.id))
  const countsById = new Map((counts ?? []).map((c) => [c.match_id, c]))
  const { data: financials } = useFinancials((data ?? []).map((m) => m.id), !!showPayments && variant === 'card')
  const financialsById = new Map((financials ?? []).map((f) => [f.match_id, f]))

  if (isLoading) return variant === 'row' ? <CricketLoader size="sm" label="Loading matches" /> : <CricketLoader label="Loading matches" />
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

  const matches = (data ?? []).filter((m) => !(hideCancelled && m.status === 'CANCELLED')).slice(skip)
  if (matches.length === 0) return <p className="text-subtle">{emptyText}</p>

  if (variant === 'row') {
    return (
      <div className="grid gap-2 sm:grid-cols-2">
        {matches.map((m) => (
          <MatchRow key={m.id} match={m} counts={countsById.get(m.id)} to={`${basePath}/${m.id}`} />
        ))}
      </div>
    )
  }

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
              <Button asChild size="sm" variant="outline" className="flex-1">
                <Link to={`${basePath}/${m.id}`}>{actionLabel}</Link>
              </Button>
              {copyPath && (
                <Button asChild size="sm" variant="outline" className="w-11 px-0">
                  <Link to={`${copyPath}?copy=${m.id}`} aria-label={`Copy ${m.title} as a new match`} title="Copy as new match">
                    <CopyPlus className="size-4" aria-hidden />
                  </Link>
                </Button>
              )}
            </div>
          }
        />
      ))}
    </div>
  )
}
