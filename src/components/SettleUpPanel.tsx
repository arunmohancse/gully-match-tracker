import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useFinalizeShares, useFinancials } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import type { Match } from '@/types/domain'
import { computeShare, isShared, SHARE_STEPS, type ShareStep } from '@/utils/cost'
import { formatINR } from '@/utils/money'

const money = (n: number) => formatINR(Math.round(n * 100) / 100)

/**
 * Shared-cost matches: split the expenses equally among the main-list players, rounded up.
 * The result is stored per player (their "amount due") and payments are tracked against it.
 */
export function SettleUpPanel({ match }: { match: Match }) {
  const { data } = useFinancials([match.id], isShared(match))
  const finalize = useFinalizeShares()
  const [step, setStep] = useState<ShareStep>(1)
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  if (!isShared(match)) return null
  const f = data?.[0]
  if (!f) return null

  const preview = computeShare(f.expenses_total, f.main_count, step)
  const listFinal = match.status === 'CLOSED' || match.status === 'COMPLETED'
  const blocker = !listFinal
    ? 'Close registration (or mark the match completed) once the player list is final. Then you can calculate the shares.'
    : f.expenses_total <= 0
      ? 'Add the match expenses first.'
      : f.main_count === 0
        ? 'Nobody is on the main list.'
        : null

  async function confirm() {
    if (finalize.isPending) return
    setError(null)
    try {
      const r = await finalize.mutateAsync({ matchId: match.id, step })
      setDone(`Each of ${r.participants} players now owes ${money(r.share_amount)}.`)
      setOpen(false)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Settle up: share the cost</h2>

      {f.shares_calculated && f.share_amount != null && !f.shares_stale && (
        <p role="status" className="rounded-md bg-green-50 p-2 text-sm text-green-800">
          Calculated: each of {f.main_count} players owes <strong>{money(f.share_amount)}</strong>.
        </p>
      )}
      {f.shares_stale && (
        <p role="alert" className="rounded-md bg-orange-50 p-2 text-sm text-orange-800">
          The expenses or the main list changed after the shares were calculated. Recalculate so every player owes the right amount.
        </p>
      )}
      {done && !f.shares_stale && <p className="sr-only" role="status">{done}</p>}

      {preview && (
        <p className="text-sm text-slate-700">
          {money(f.expenses_total)} ÷ {f.main_count} players = {money(preview.exact)}, rounded up to <strong>{money(preview.share)}</strong> each
          {preview.surplus > 0 ? ` (${money(preview.surplus)} over the expenses).` : '.'}
        </p>
      )}
      {blocker && <p className="text-sm text-slate-600">{blocker}</p>}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1.5">
          <label htmlFor="share-step" className="text-sm font-medium">
            Round up to the next
          </label>
          <select
            id="share-step"
            value={step}
            onChange={(e) => setStep(Number(e.target.value) as ShareStep)}
            className="h-11 rounded-md border border-slate-300 bg-white px-3"
          >
            {SHARE_STEPS.map((s) => (
              <option key={s} value={s}>
                ₹{s}
              </option>
            ))}
          </select>
        </div>
        <Button
          disabled={!!blocker || !preview}
          onClick={() => {
            setError(null)
            setOpen(true)
          }}
        >
          {f.shares_calculated ? 'Recalculate shares' : 'Calculate shares'}
        </Button>
      </div>

      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title={f.shares_calculated ? 'Recalculate the shares?' : 'Calculate the shares?'}
        description={
          preview
            ? `${f.main_count} main-list players will each owe ${money(preview.share)}.` +
              (f.paid_count > 0 ? ` ${f.paid_count} player(s) have already paid; their payments are kept, so check anyone whose amount no longer matches.` : '') +
              ' Players on the waiting list owe nothing.'
            : ''
        }
        confirmLabel={f.shares_calculated ? 'Recalculate' : 'Calculate shares'}
        loadingLabel="Calculating..."
        cancelLabel="Not yet"
        loading={finalize.isPending}
        error={error}
        onConfirm={confirm}
      />
    </Card>
  )
}
