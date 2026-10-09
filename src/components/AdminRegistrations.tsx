import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { PaymentActions } from '@/components/PaymentActions'
import { ReminderButton } from '@/components/ReminderButton'
import { useLastReminders } from '@/hooks/useReminders'
import { PaymentBadge } from '@/components/RegistrationBadges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAdminMove, useAdminRegistrations, useCancelRegistration } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import type { AdminRegistration, Match } from '@/types/domain'
import { formatClock } from '@/utils/dates'
import { amountText, canTrackPayment, hasPayments } from '@/utils/cost'

type Action = { type: 'cancel' | 'demote' | 'promote'; reg: AdminRegistration }

const nameOf = (r: AdminRegistration) => r.player?.full_name ?? 'Unknown player'

function Row({ reg, children, detail }: { reg: AdminRegistration; children: React.ReactNode; detail: React.ReactNode }) {
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
      <span className="w-7 text-right text-slate-500">{reg.list_position}.</span>
      <div className="min-w-0 flex-1">
        <div className="truncate font-medium">{nameOf(reg)}</div>
        <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">{detail}</div>
      </div>
      <div className="flex flex-wrap gap-2">{children}</div>
    </li>
  )
}

export function AdminRegistrations({ match }: { match: Match }) {
  const { data, isLoading, error, refetch } = useAdminRegistrations(match.id)
  const { data: lastReminders } = useLastReminders(match.id)
  const cancel = useCancelRegistration()
  const move = useAdminMove()
  const [action, setAction] = useState<Action | null>(null)
  const [swapId, setSwapId] = useState('')
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <Card className="text-slate-500">Loading registrations...</Card>
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

  const regs = data ?? []
  const main = regs.filter((r) => r.status === 'ACTIVE' && r.list_type === 'MAIN_LIST').sort((a, b) => (a.list_position ?? 0) - (b.list_position ?? 0))
  const waiting = regs.filter((r) => r.status === 'ACTIVE' && r.list_type === 'WAITING_LIST').sort((a, b) => (a.list_position ?? 0) - (b.list_position ?? 0))
  const cancelled = regs.filter((r) => r.status === 'CANCELLED')
  const mainFull = main.length >= match.max_players
  const busy = cancel.isPending || move.isPending

  function open(type: Action['type'], reg: AdminRegistration) {
    setActionError(null)
    setSwapId('')
    setAction({ type, reg })
  }

  async function confirm() {
    if (!action || busy) return
    setActionError(null)
    try {
      if (action.type === 'cancel') await cancel.mutateAsync(action.reg.id)
      else if (action.type === 'demote') await move.mutateAsync({ registrationId: action.reg.id, target: 'WAITING_LIST' })
      else await move.mutateAsync({ registrationId: action.reg.id, target: 'MAIN_LIST', swapWith: mainFull ? swapId : undefined })
      setAction(null)
    } catch (e) {
      setActionError(toFriendlyMessage(e))
    }
  }

  const dialog = (() => {
    if (!action) return null
    const name = nameOf(action.reg)
    const next = waiting[0]
    if (action.type === 'cancel') {
      const promotes = action.reg.list_type === 'MAIN_LIST' && next
      return {
        title: `Cancel ${name}'s registration?`,
        description: promotes ? `${nameOf(next)} will be moved up from the waiting list automatically.` : 'This frees their place.',
        confirmLabel: 'Cancel registration',
        loadingLabel: 'Cancelling...',
        destructive: true,
      }
    }
    if (action.type === 'demote') {
      return {
        title: 'Move this player to the waiting list?',
        description: `${name} goes to the end of the waiting list and ${next ? nameOf(next) : 'the first waiting player'} takes their main-list spot.`,
        confirmLabel: 'Move to waiting list',
        loadingLabel: 'Moving...',
        destructive: false,
      }
    }
    return {
      title: 'Move this player to the main list?',
      description: mainFull
        ? `The main list is full. ${name} replaces the player you choose below, who goes to the front of the waiting list.`
        : `${name} joins the main list.`,
      confirmLabel: 'Move to main list',
      loadingLabel: 'Moving...',
      destructive: false,
    }
  })()

  return (
    <div className="space-y-4">
      <Card className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold">Registrations</h2>
        <span className="text-sm text-slate-600">
          {main.length} / {match.max_players} main list · {waiting.length} waiting
        </span>
      </Card>

      <Card className="space-y-2 p-0">
        <h3 className="px-3 pt-3 text-sm font-semibold uppercase tracking-wide text-green-700">Main list ({main.length})</h3>
        {main.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-slate-500">Nobody registered yet.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {main.map((r) => (
              <Row
                key={r.id}
                reg={r}
                detail={
                  hasPayments(match) ? (
                    <>
                      <PaymentBadge status={r.payment_status} />
                      <span>{amountText(match, r)}</span>
                    </>
                  ) : (
                    <span>Registered {formatClock(r.registered_at)}</span>
                  )
                }
              >
                {canTrackPayment(match, r) && <PaymentActions reg={r} match={match} />}
                <ReminderButton reg={r} match={match} lastAt={lastReminders?.[r.id]} />
                {waiting.length > 0 && (
                  <Button size="sm" variant="outline" onClick={() => open('demote', r)}>
                    Move to waiting
                  </Button>
                )}
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => open('cancel', r)}>
                  Cancel
                </Button>
              </Row>
            ))}
          </ul>
        )}
      </Card>

      <Card className="space-y-2 p-0">
        <h3 className="px-3 pt-3 text-sm font-semibold uppercase tracking-wide text-orange-700">Waiting list ({waiting.length})</h3>
        {waiting.length === 0 ? (
          <p className="px-3 pb-3 text-sm text-slate-500">Nobody is waiting.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {waiting.map((r) => (
              <Row key={r.id} reg={r} detail={<span>Registered {formatClock(r.registered_at)}</span>}>
                <Button size="sm" variant="outline" onClick={() => open('promote', r)}>
                  Promote to main
                </Button>
                <Button size="sm" variant="outline" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => open('cancel', r)}>
                  Cancel
                </Button>
              </Row>
            ))}
          </ul>
        )}
      </Card>

      {cancelled.length > 0 && (
        <Card className="p-0">
          <details>
            <summary className="cursor-pointer px-3 py-3 text-sm font-semibold text-slate-600">Cancelled ({cancelled.length})</summary>
            <ul className="divide-y divide-slate-100">
              {cancelled.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                  <span>{nameOf(r)}</span>
                  {r.payment_status === 'PAID' ? (
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-800">Paid: refund needed</span>
                      <PaymentActions reg={r} match={match} />
                    </span>
                  ) : r.payment_status === 'REFUNDED' ? (
                    <span className="text-slate-500">Cancelled · refunded</span>
                  ) : (
                    <span className="text-slate-500">Cancelled</span>
                  )}
                </li>
              ))}
            </ul>
          </details>
        </Card>
      )}

      {dialog && (
        <ConfirmDialog
          open={!!action}
          onOpenChange={(o) => !o && setAction(null)}
          title={dialog.title}
          description={dialog.description}
          confirmLabel={dialog.confirmLabel}
          loadingLabel={dialog.loadingLabel}
          destructive={dialog.destructive}
          loading={busy}
          error={actionError}
          confirmDisabled={action?.type === 'promote' && mainFull && !swapId}
          onConfirm={confirm}
        >
          {action?.type === 'promote' && mainFull && (
            <div className="space-y-1.5">
              <label htmlFor="swap" className="text-sm font-medium">
                Move this main-list player to the waiting list
              </label>
              <select id="swap" value={swapId} onChange={(e) => setSwapId(e.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3">
                <option value="">Choose a player...</option>
                {main.map((m) => (
                  <option key={m.id} value={m.id}>
                    #{m.list_position} {nameOf(m)}
                  </option>
                ))}
              </select>
            </div>
          )}
        </ConfirmDialog>
      )}
    </div>
  )
}
