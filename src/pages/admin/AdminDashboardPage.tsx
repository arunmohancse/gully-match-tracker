import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MyDuesCard } from '@/components/MyDuesCard'
import { MatchList } from '@/components/MatchList'
import { Tile } from '@/components/PaymentSummary'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useFinancials } from '@/hooks/usePayments'
import { useMatches } from '@/hooks/useMatches'
import { formatINR } from '@/utils/money'

/** Money totals across the upcoming (non-cancelled) matches shown below. */
function UpcomingTotals() {
  const { data: matches } = useMatches('upcoming')
  const ids = (matches ?? []).filter((m) => m.status !== 'CANCELLED').map((m) => m.id)
  const { data } = useFinancials(ids)
  if (!data || data.length === 0) return null

  const collected = data.reduce((sum, f) => sum + Number(f.collected), 0)
  const pending = data.reduce((sum, f) => sum + Number(f.pending), 0)
  const expenses = data.reduce((sum, f) => sum + Number(f.expenses_total), 0)
  const balance = collected - expenses

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Upcoming matches: money</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile label="Collected" value={formatINR(collected)} tone="good" />
        <Tile label="Pending" value={formatINR(pending)} tone={pending > 0 ? 'bad' : undefined} />
        <Tile label="Expenses" value={formatINR(expenses)} />
        <Tile label="Balance" value={formatINR(balance)} tone={balance < 0 ? 'bad' : 'good'} hint="Collected − expenses" />
      </div>
    </Card>
  )
}

export function AdminDashboardPage() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <Button asChild>
          <Link to="/admin/matches/new">
            <Plus className="size-4" aria-hidden /> Create match
          </Link>
        </Button>
      </div>

      {/* Admins play too: their own unpaid shares, if any. */}
      <MyDuesCard />

      <UpcomingTotals />

      <h2 className="font-semibold text-slate-700">Upcoming matches</h2>
      <MatchList scope="upcoming" basePath="/admin/matches" actionLabel="Manage match" emptyText="No upcoming matches. Create one to get started." hideCancelled showPayments />

      <Button asChild variant="outline">
        <Link to="/admin/activity">View activity log</Link>
      </Button>
    </div>
  )
}
