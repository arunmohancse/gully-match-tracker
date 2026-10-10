import { Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MyDuesCard } from '@/components/MyDuesCard'
import { MatchList } from '@/components/MatchList'
import { Tile } from '@/components/PaymentSummary'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useFinancials } from '@/hooks/usePayments'
import { useMatches } from '@/hooks/useMatches'
import { daysAgoISO, todayISO } from '@/utils/dates'
import { formatINR } from '@/utils/money'
import { moneySummary } from '@/utils/moneySummary'

/** Money still to collect across every match, plus how the last 30 days went. */
function MoneyOverview() {
  const { data: matches } = useMatches('all')
  const live = (matches ?? []).filter((m) => m.status !== 'DRAFT' && m.status !== 'CANCELLED')
  const { data: financials } = useFinancials(
    live.map((m) => m.id),
    live.length > 0,
  )
  if (!financials || financials.length === 0) return null

  const s = moneySummary(live, financials, todayISO(), daysAgoISO(30))
  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Money</h2>
        <span className="flex gap-4">
          <Link to="/admin/money" className="text-sm font-medium text-brand underline">
            Full report
          </Link>
          <Link to="/admin/payments" className="text-sm font-medium text-brand underline">
            Open payments
          </Link>
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Tile
          label="To collect"
          value={formatINR(s.pending)}
          tone={s.pending > 0 ? 'warn' : 'good'}
          hint={s.followUpCount > 0 ? `${s.followUpCount} match${s.followUpCount === 1 ? '' : 'es'} to follow up` : 'Nothing pending'}
        />
        <Tile label="Collected" value={formatINR(s.recent.collected)} tone="good" hint="Last 30 days + upcoming" />
        <Tile label="Expenses" value={formatINR(s.recent.expenses)} hint="Last 30 days + upcoming" />
        <Tile label="Balance" value={formatINR(s.recent.balance)} tone={s.recent.balance < 0 ? 'bad' : 'good'} hint="Collected − expenses" />
      </div>
      {s.refundsDue > 0 && (
        <p role="status" className="rounded-md bg-orange-50 p-2 text-sm text-orange-800">
          Refunds due: {formatINR(s.refundsDue)} for cancelled players who had paid.
        </p>
      )}
      <p className="text-xs text-slate-500">Includes matches from the last 30 days and all upcoming ones. Shared-cost matches appear once their shares are calculated.</p>
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

      <MoneyOverview />

      <h2 className="font-semibold text-slate-700">Upcoming matches</h2>
      <MatchList scope="upcoming" basePath="/admin/matches" actionLabel="Manage match" emptyText="No upcoming matches. Create one to get started." hideCancelled showPayments />

      <Button asChild variant="outline">
        <Link to="/admin/activity">View activity log</Link>
      </Button>
    </div>
  )
}
