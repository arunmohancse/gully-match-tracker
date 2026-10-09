import { Link, useLocation, useParams } from 'react-router-dom'
import { MatchDetails } from '@/components/MatchDetails'
import { RegistrationPanel } from '@/components/RegistrationPanel'
import { RosterList } from '@/components/RosterList'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useMatch } from '@/hooks/useMatches'
import { useMatchCounts, useRoster } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'

/** Public-friendly match page, shared by link (/matches/:id). Works logged in or out. */
export function MatchDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { session } = useAuth()
  const { data: match, isLoading, error } = useMatch(id)
  const { data: counts } = useMatchCounts(id ? [id] : [])
  const { data: roster, error: rosterError } = useRoster(id, !!session && !!match)

  if (isLoading) return <p className="text-slate-500">Loading match...</p>
  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {toFriendlyMessage(error)}
      </p>
    )
  }
  if (!match) {
    return (
      <Card className="space-y-2">
        <h1 className="text-xl font-bold">Match not found</h1>
        <p className="text-slate-600">This match may have been removed or is not published yet.</p>
      </Card>
    )
  }

  const c = counts?.[0]
  return (
    <div className="space-y-4">
      <MatchDetails match={match} />

      {c && (
        <Card className="flex items-center justify-between">
          <span className="font-semibold">
            {c.main_count} / {match.max_players} players registered
          </span>
          {c.waiting_count > 0 && <span className="text-sm text-orange-700">{c.waiting_count} on waiting list</span>}
        </Card>
      )}

      {session ? (
        <>
          <RegistrationPanel match={match} />
          {rosterError && (
            <p role="alert" className="text-sm text-red-600">
              {toFriendlyMessage(rosterError)}
            </p>
          )}
          {roster && <RosterList entries={roster} />}
        </>
      ) : (
        <Button asChild size="lg" className="w-full">
          <Link to="/login" state={{ from: location.pathname }}>
            Login to Register
          </Link>
        </Button>
      )}
    </div>
  )
}
