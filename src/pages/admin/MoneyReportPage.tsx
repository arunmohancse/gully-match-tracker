import { ChevronRight } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Tile } from '@/components/PaymentSummary'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useFinancials } from '@/hooks/usePayments'
import { useMatches } from '@/hooks/useMatches'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { daysAgoISO, formatShortDate, todayISO } from '@/utils/dates'
import { formatINR } from '@/utils/money'
import { moneyReport } from '@/utils/moneyReport'

type Preset = 'ALL' | 'MONTH' | 'DAYS30' | 'CUSTOM'

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'ALL', label: 'All time' },
  { key: 'MONTH', label: 'This month' },
  { key: 'DAYS30', label: 'Last 30 days' },
  { key: 'CUSTOM', label: 'Custom dates' },
]

/** Collected, expenses and balance over any period, based on match dates. */
export function MoneyReportPage() {
  const { data: matches, isLoading, error, refetch } = useMatches('all')
  const [preset, setPreset] = useState<Preset>('ALL')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const live = useMemo(() => (matches ?? []).filter((m) => m.status !== 'DRAFT' && m.status !== 'CANCELLED'), [matches])
  const { data: financials, isLoading: loadingMoney } = useFinancials(live.map((m) => m.id), live.length > 0)

  if (isLoading) return <p className="text-slate-500">Loading matches...</p>
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-red-600">
          {toFriendlyMessage(error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const today = todayISO()
  const range: { from: string | null; to: string | null } =
    preset === 'MONTH' ? { from: `${today.slice(0, 7)}-01`, to: null }
    : preset === 'DAYS30' ? { from: daysAgoISO(30), to: null }
    : preset === 'CUSTOM' ? { from: from || null, to: to || null }
    : { from: null, to: null }
  const badRange = preset === 'CUSTOM' && !!from && !!to && from > to

  const report = financials && !badRange ? moneyReport(live, financials, range.from, range.to) : null

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">Money report</h1>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Period">
        {PRESETS.map((p) => (
          <Button key={p.key} size="sm" variant={preset === p.key ? 'default' : 'outline'} aria-pressed={preset === p.key} onClick={() => setPreset(p.key)}>
            {p.label}
          </Button>
        ))}
      </div>

      {preset === 'CUSTOM' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium">
            From
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </label>
          <label className="space-y-1 text-sm font-medium">
            To
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </label>
        </div>
      )}
      {badRange && (
        <p role="alert" className="text-sm text-red-600">
          The From date must be on or before the To date.
        </p>
      )}

      {live.length === 0 ? (
        <Card className="text-slate-600">No published matches yet.</Card>
      ) : loadingMoney || !report ? (
        !badRange && <p className="text-slate-500">Loading money...</p>
      ) : (
        <>
          <Card className="space-y-3">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Tile label="Collected" value={formatINR(report.collected)} tone="good" />
              <Tile label="Expenses" value={formatINR(report.expenses)} />
              <Tile label="Balance" value={formatINR(report.balance)} tone={report.balance < 0 ? 'bad' : 'good'} hint="Collected − expenses" />
              <Tile label="Matches" value={report.matches} />
            </div>
            <p className="text-xs text-slate-500">
              Counted by match date, including upcoming matches in the period. Shared-cost matches count once their shares are calculated
              {report.notCalculated > 0 ? ` (${report.notCalculated} not calculated yet, left out)` : ''}.
            </p>
          </Card>

          {report.rows.length === 0 ? (
            <p className="text-slate-500">No matches in this period.</p>
          ) : (
            <Card className="p-0">
              <ul className="divide-y divide-slate-100">
                {report.rows.map((r) => (
                  <li key={r.match.id}>
                    <Link to={`/admin/payments/${r.match.id}`} className="flex items-center gap-3 px-3 py-3 hover:bg-slate-50">
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-medium">{r.match.title}</div>
                        <div className="text-sm text-slate-600">{formatShortDate(r.match.match_date)}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div>
                          {formatINR(r.collected)} <span className="text-slate-500">in</span> · {formatINR(r.expenses)} <span className="text-slate-500">out</span>
                        </div>
                        <div className={cn('font-medium', r.balance < 0 ? 'text-red-700' : 'text-green-700')}>{formatINR(r.balance)}</div>
                      </div>
                      <ChevronRight className="size-4 shrink-0 text-slate-400" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
