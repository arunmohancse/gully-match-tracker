import { AlertCircle, CheckCircle2, ChevronRight, Plus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { MyDuesCard } from '@/components/MyDuesCard'
import { MatchList } from '@/components/MatchList'
import { NextMatchHero } from '@/components/NextMatchHero'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/hooks/useAuth'
import { useFinancials } from '@/hooks/usePayments'
import { useMatches } from '@/hooks/useMatches'
import { cn } from '@/lib/utils'
import { daysAgoISO, formatWeekday, formatShortDate, todayISO } from '@/utils/dates'
import { formatINR } from '@/utils/money'
import { isUnopened } from '@/utils/matchStatus'
import { moneySummary } from '@/utils/moneySummary'
import { JoinCommunityCard } from '@/components/WhatsAppCommunity'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'bad' }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-bold text-subtle">{label}</div>
      <div className={cn('truncate font-display text-2xl font-bold', tone === 'bad' && 'text-danger')}>{value}</div>
    </div>
  )
}

/** Money still to collect across every match, plus how the last 30 days went. */
function MoneyOverview() {
  const { data: matches } = useMatches('all')
  const live = (matches ?? []).filter((m) => !isUnopened(m.status) && m.status !== 'CANCELLED')
  const { data: financials } = useFinancials(
    live.map((m) => m.id),
    live.length > 0,
  )
  if (!financials || financials.length === 0) return null

  const s = moneySummary(live, financials, todayISO(), daysAgoISO(30))
  return (
    <Card className="space-y-4 rounded-2xl">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-extrabold">
          Money <span className="font-semibold text-subtle">· last 30 days + upcoming</span>
        </h2>
        <Link to="/admin/money" className="shrink-0 text-sm font-bold text-brand hover:underline">
          Full report
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Stat label="Collected" value={formatINR(s.recent.collected)} />
        <Stat label="Expenses" value={formatINR(s.recent.expenses)} />
        <Stat label="Balance" value={formatINR(s.recent.balance)} tone={s.recent.balance < 0 ? 'bad' : undefined} />
      </div>
      {s.pending > 0 ? (
        <Link to="/admin/payments" className="flex items-center gap-3 rounded-xl bg-warning-soft p-3 text-warning hover:opacity-90 focus-visible:outline-2 focus-visible:outline-brand">
          <AlertCircle className="size-5 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1">
            <span className="block font-extrabold">{formatINR(s.pending)} to collect</span>
            <span className="block text-sm font-semibold">
              {s.followUpCount} match{s.followUpCount === 1 ? '' : 'es'} to follow up
            </span>
          </span>
          <ChevronRight className="size-4 shrink-0" aria-hidden />
        </Link>
      ) : (
        <p className="flex items-center gap-2 text-sm font-semibold text-success">
          <CheckCircle2 className="size-4" aria-hidden /> Nothing pending to collect
        </p>
      )}
      {s.refundsDue > 0 && (
        <p role="status" className="rounded-xl bg-warning-soft p-3 text-sm text-warning">
          Refunds due: {formatINR(s.refundsDue)} for cancelled players who had paid.
        </p>
      )}
      <p className="text-xs text-subtle">Shared-cost matches appear once their shares are calculated.</p>
    </Card>
  )
}

export function AdminDashboardPage() {
  const { profile } = useAuth()
  const today = todayISO()
  const { data: upcoming } = useMatches('upcoming')
  const hasNext = (upcoming ?? []).some((m) => m.status !== 'CANCELLED')

  return (
    <div className="space-y-5">
      <PageHeader
        eyebrow={`${formatWeekday(today)}, ${formatShortDate(today).replace(/ \d{4}$/, '')}`}
        title={`Hi ${profile?.full_name.split(' ')[0] ?? 'there'}`}
        action={
          <Button asChild className="rounded-full">
            <Link to="/admin/matches/new">
              <Plus className="size-4" aria-hidden /> New match
            </Link>
          </Button>
        }
      />

      {/* Admins play too: their own unpaid shares, if any. */}
      <MyDuesCard />

      <NextMatchHero basePath="/admin/matches" actionLabel="Manage match" />

      <JoinCommunityCard dismissible />

      <MoneyOverview />

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold">Coming up</h2>
          <Link to="/admin/matches" className="text-sm font-bold text-brand hover:underline">
            All matches
          </Link>
        </div>
        <MatchList scope="upcoming" basePath="/admin/matches" actionLabel="Manage match" emptyText={hasNext ? 'Nothing else scheduled yet.' : 'No upcoming matches. Create one to get started.'} hideCancelled variant="row" skip={1} />
      </section>

      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link to="/admin/activity">View activity log</Link>
      </Button>
    </div>
  )
}
