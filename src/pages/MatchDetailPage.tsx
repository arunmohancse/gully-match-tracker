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
import { CricketLoader } from '@/components/CricketLoader'

/** Public-friendly match page, shared by link (/matches/:id). Works logged in or out. */
export function MatchDetailPage() {
  const { id } = useParams()
  const location = useLocation()
  const { session } = useAuth()
  const { data: match, isLoading, error } = useMatch(id)
  const { data: counts } = useMatchCounts(id ? [id] : [])
  const { data: roster, error: rosterError } = useRoster(id, !!session && !!match)

  if (isLoading) return <CricketLoader label="Loading match" />
  if (error) {
    return (
      <p role="alert" className="text-danger">
        {toFriendlyMessage(error)}
      </p>
    )
  }
  if (!match) {
    return (
      <Card className="space-y-2">
        <h1 className="font-display text-3xl font-bold leading-none">Match not found</h1>
        <p className="text-muted">This match may have been removed or is not published yet.</p>
      </Card>
    )
  }

  const c = counts?.[0]
  return (
    <div className="space-y-4">
      <MatchDetails match={match} counts={c} backTo={session ? '/matches' : undefined} />

      {session ? (
        <>
          <RegistrationPanel match={match} />
          {rosterError && (
            <p role="alert" className="text-sm text-danger">
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
