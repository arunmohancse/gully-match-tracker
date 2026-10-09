import { useSearchParams } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuditLog } from '@/hooks/useAudit'
import { useMatches } from '@/hooks/useMatches'
import { toFriendlyMessage } from '@/lib/errors'
import { AUDIT_CATEGORIES, describeAudit, type AuditCategory } from '@/utils/audit'
import { formatShortDate } from '@/utils/dates'
import { formatReminded } from '@/utils/reminders'

/** Admin activity log: who did what, newest first. Optionally filtered to one match via ?match=<id>. */
export function ActivityPage() {
  const [params, setParams] = useSearchParams()
  const category = (params.get('type') as AuditCategory) in AUDIT_CATEGORIES ? (params.get('type') as AuditCategory) : 'ALL'
  const matchId = params.get('match') ?? ''

  const { data: matches } = useMatches('all')
  const { data, isLoading, error, fetchNextPage, hasNextPage, isFetchingNextPage, refetch } = useAuditLog(category, matchId)

  function update(next: { type?: AuditCategory; match?: string }) {
    const p = new URLSearchParams(params)
    if (next.type !== undefined) {
      if (next.type === 'ALL') p.delete('type')
      else p.set('type', next.type)
    }
    if (next.match !== undefined) {
      if (next.match) p.set('match', next.match)
      else p.delete('match')
    }
    setParams(p, { replace: true })
  }

  const pages = data?.pages ?? []
  const entries = pages.flatMap((p) => p.entries)
  const names = {
    users: Object.assign({}, ...pages.map((p) => p.names.users)),
    matches: Object.assign({}, ...pages.map((p) => p.names.matches)),
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Activity</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label htmlFor="type" className="text-sm font-medium">
            Type
          </label>
          <select id="type" value={category} onChange={(e) => update({ type: e.target.value as AuditCategory })} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3">
            {(Object.keys(AUDIT_CATEGORIES) as AuditCategory[]).map((c) => (
              <option key={c} value={c}>
                {AUDIT_CATEGORIES[c].label}
              </option>
            ))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label htmlFor="match" className="text-sm font-medium">
            Match
          </label>
          <select id="match" value={matchId} onChange={(e) => update({ match: e.target.value })} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3">
            <option value="">All matches</option>
            {(matches ?? []).map((m) => (
              <option key={m.id} value={m.id}>
                {formatShortDate(m.match_date)} · {m.title}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading && <p className="text-slate-500">Loading activity...</p>}
      {error && (
        <div className="space-y-2">
          <p role="alert" className="text-red-600">
            {toFriendlyMessage(error)}
          </p>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}
      {!isLoading && !error && entries.length === 0 && <p className="text-slate-500">No activity found.</p>}

      {entries.length > 0 && (
        <Card className="p-0">
          <ul className="divide-y divide-slate-100">
            {entries.map((e) => (
              <li key={e.id} className="px-3 py-3">
                <p className="text-sm">{describeAudit(e, names)}</p>
                <p className="text-xs text-slate-500">{formatReminded(e.created_at)}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {hasNextPage && (
        <Button variant="outline" className="w-full" onClick={() => fetchNextPage()} loading={isFetchingNextPage}>
          {isFetchingNextPage ? 'Loading...' : 'Load more'}
        </Button>
      )}
    </div>
  )
}
