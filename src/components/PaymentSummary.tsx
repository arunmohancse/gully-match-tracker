import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useFinancials } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { formatINR } from '@/utils/money'

export function Tile({ label, value, tone, hint }: { label: string; value: ReactNode; tone?: 'good' | 'bad' | 'warn'; hint?: string }) {
  return (
    <div className="rounded-md border border-slate-200 p-3">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cn('text-xl font-bold', tone === 'good' && 'text-green-700', tone === 'bad' && 'text-red-700', tone === 'warn' && 'text-orange-700')}>{value}</div>
      {hint && <div className="text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

/** Expected / collected / pending / expenses / balance for one match. */
export function PaymentSummary({ matchId }: { matchId: string }) {
  const { data, isLoading, error, refetch } = useFinancials([matchId])

  if (isLoading) return <Card className="text-slate-500">Loading payment summary...</Card>
  if (error) {
    return (
      <Card className="space-y-2">
        <p role="alert" className="text-red-600">
          {toFriendlyMessage(error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    )
  }
  const f = data?.[0]
  if (!f) return null

  if (f.cost_model === 'SHARED_COST') {
    return (
      <Card className="space-y-3">
        <h2 className="font-semibold">Payment summary</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Tile label="Expenses" value={formatINR(f.expenses_total)} />
          <Tile label="Players sharing" value={f.main_count} hint="Main list" />
          <Tile
            label="Share each"
            value={f.shares_calculated && f.share_amount != null ? formatINR(f.share_amount) : 'Not calculated'}
            hint={f.estimated_share != null ? `Estimate ${formatINR(Math.round(f.estimated_share * 100) / 100)}` : undefined}
          />
          {f.shares_calculated && <Tile label="To collect" value={formatINR(f.expected)} hint={`${f.paid_count} paid, ${f.unpaid_count} unpaid`} />}
          <Tile label="Collected" value={formatINR(f.collected)} tone="good" />
          {f.shares_calculated && <Tile label="Pending" value={formatINR(f.pending)} tone={f.pending > 0 ? 'bad' : undefined} />}
          <Tile label="Balance" value={formatINR(f.balance)} tone={f.balance < 0 ? 'bad' : 'good'} hint="Collected − expenses" />
          {f.shares_calculated && (
            <Tile label="If everyone pays" value={formatINR(f.projected_balance)} hint="Left over from rounding up" />
          )}
        </div>
        {f.shares_stale && <p className="text-sm text-orange-800">Shares are out of date. Recalculate them below.</p>}
        {f.waived_count > 0 && <p className="text-sm text-slate-600">{f.waived_count} player(s) have their share waived.</p>}
        {f.refunds_due > 0 && (
          <p role="status" className="rounded-md bg-orange-50 p-2 text-sm text-orange-800">
            Refunds due: {formatINR(f.refunds_due)} for cancelled players who had paid. Mark them as refunded once returned.
          </p>
        )}
      </Card>
    )
  }

  const hasFee = f.registration_fee > 0

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Payment summary</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {hasFee && <Tile label="Expected" value={formatINR(f.expected)} hint={`${f.main_count} players × ${formatINR(f.registration_fee)}`} />}
        {hasFee && <Tile label="Collected" value={formatINR(f.collected)} tone="good" hint={`${f.paid_count} paid`} />}
        {hasFee && <Tile label="Pending" value={formatINR(f.pending)} tone={f.pending > 0 ? 'bad' : undefined} hint={`${f.unpaid_count} unpaid`} />}
        <Tile label="Expenses" value={formatINR(f.expenses_total)} />
        <Tile label="Balance" value={formatINR(f.balance)} tone={f.balance < 0 ? 'bad' : 'good'} hint="Collected − expenses" />
        {hasFee && <Tile label="If everyone pays" value={formatINR(f.projected_balance)} tone={f.projected_balance < 0 ? 'bad' : undefined} hint="Collected + pending − expenses" />}
      </div>
      {f.waived_count > 0 && <p className="text-sm text-slate-600">{f.waived_count} player(s) have their fee waived.</p>}
      {f.refunds_due > 0 && (
        <p role="status" className="rounded-md bg-orange-50 p-2 text-sm text-orange-800">
          Refunds due: {formatINR(f.refunds_due)} for cancelled players who had paid. Mark them as refunded once returned.
        </p>
      )}
    </Card>
  )
}
