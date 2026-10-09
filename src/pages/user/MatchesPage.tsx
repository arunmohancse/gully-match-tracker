import { useState } from 'react'
import { MatchList } from '@/components/MatchList'
import { Button } from '@/components/ui/button'

export function MatchesPage() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Matches</h1>
      <div className="flex gap-2" role="group" aria-label="Filter matches">
        <Button size="sm" variant={scope === 'upcoming' ? 'default' : 'outline'} onClick={() => setScope('upcoming')} aria-pressed={scope === 'upcoming'}>
          Upcoming
        </Button>
        <Button size="sm" variant={scope === 'past' ? 'default' : 'outline'} onClick={() => setScope('past')} aria-pressed={scope === 'past'}>
          Past
        </Button>
      </div>
      <MatchList
        scope={scope}
        basePath="/matches"
        actionLabel="View match"
        emptyText={scope === 'upcoming' ? 'No upcoming matches yet.' : 'No past matches.'}
        hideCancelled={scope === 'upcoming'}
      />
    </div>
  )
}
