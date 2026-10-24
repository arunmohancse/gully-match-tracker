import { useState } from 'react'
import { MatchList } from '@/components/MatchList'
import { PageHeader } from '@/components/PageHeader'
import { Segmented } from '@/components/ui/segmented'

export function MatchesPage() {
  const [scope, setScope] = useState<'upcoming' | 'past'>('upcoming')
  return (
    <div className="space-y-4">
      <PageHeader title="Matches" />
      <Segmented
        label="Filter matches"
        value={scope}
        onChange={setScope}
        options={[
          { value: 'upcoming', label: 'Upcoming' },
          { value: 'past', label: 'Past' },
        ]}
      />
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
