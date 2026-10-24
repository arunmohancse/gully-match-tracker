import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MatchList } from '@/components/MatchList'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Segmented } from '@/components/ui/segmented'
import type { MatchScope } from '@/services/matchService'

const TABS: { value: MatchScope; label: string }[] = [
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'past', label: 'Past' },
  { value: 'all', label: 'All' },
]

export function AdminMatchesPage() {
  const [scope, setScope] = useState<MatchScope>('upcoming')
  return (
    <div className="space-y-4">
      <PageHeader
        title="Matches"
        action={
          <Button asChild className="rounded-full">
            <Link to="/admin/matches/new">
              <Plus className="size-4" aria-hidden /> New match
            </Link>
          </Button>
        }
      />
      <Segmented label="Filter matches" value={scope} onChange={setScope} options={TABS} />
      <MatchList scope={scope} basePath="/admin/matches" actionLabel="Manage" emptyText="No matches found." showPayments copyPath="/admin/matches/new" />
    </div>
  )
}
