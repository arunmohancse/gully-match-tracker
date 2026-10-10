import { Plus } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MatchList } from '@/components/MatchList'
import { Button } from '@/components/ui/button'
import type { MatchScope } from '@/services/matchService'

const TABS: { scope: MatchScope; label: string }[] = [
  { scope: 'upcoming', label: 'Upcoming' },
  { scope: 'past', label: 'Past' },
  { scope: 'all', label: 'All' },
]

export function AdminMatchesPage() {
  const [scope, setScope] = useState<MatchScope>('upcoming')
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Matches</h1>
        <Button asChild>
          <Link to="/admin/matches/new">
            <Plus className="size-4" aria-hidden /> Create match
          </Link>
        </Button>
      </div>
      <div className="flex gap-2" role="group" aria-label="Filter matches">
        {TABS.map((t) => (
          <Button key={t.scope} size="sm" variant={scope === t.scope ? 'default' : 'outline'} onClick={() => setScope(t.scope)} aria-pressed={scope === t.scope}>
            {t.label}
          </Button>
        ))}
      </div>
      <MatchList scope={scope} basePath="/admin/matches" actionLabel="Manage" emptyText="No matches found." showPayments copyPath="/admin/matches/new" />
    </div>
  )
}
