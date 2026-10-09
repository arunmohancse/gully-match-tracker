import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PaymentActions } from '@/components/PaymentActions'
import { PaymentInstructionsCard } from '@/components/PaymentInstructionsCard'
import { PaymentSummary } from '@/components/PaymentSummary'
import { PaymentBadge } from '@/components/RegistrationBadges'
import { ReminderButton } from '@/components/ReminderButton'
import { ReminderQueue } from '@/components/ReminderQueue'
import { SettleUpPanel } from '@/components/SettleUpPanel'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMatch } from '@/hooks/useMatches'
import { useAdminRegistrations } from '@/hooks/useRegistrations'
import { useLastReminders } from '@/hooks/useReminders'
import { toFriendlyMessage } from '@/lib/errors'
import { formatShortDate } from '@/utils/dates'
import { amountText, canTrackPayment, hasPayments, isShared } from '@/utils/cost'
import { formatINR } from '@/utils/money'
import { canRemind } from '@/utils/reminders'

type Filter = 'ALL' | 'UNPAID' | 'PAID'

export function PaymentMatchPage() {
  const { matchId = '' } = useParams()
  const { data: match, isLoading, error } = useMatch(matchId)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<string[] | null>(null)

  const { data: regs, error: regsError } = useAdminRegistrations(matchId)
  const { data: lastReminders } = useLastReminders(matchId)

  if (isLoading) return <p className="text-slate-500">Loading match...</p>
  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {toFriendlyMessage(error)}
      </p>
    )
  }

  if (!match) return <p className="text-slate-600">Match not found.</p>

  const main = (regs ?? []).filter((r) => r.status === 'ACTIVE' && r.list_type === 'MAIN_LIST')
  const rows = main.filter((r) => filter === 'ALL' || r.payment_status === filter)
  const refunds = (regs ?? []).filter((r) => r.status === 'CANCELLED' && r.payment_status === 'PAID')
  const remindable = main.filter((r) => canRemind(r, match) && r.player?.phone)
  const pickedRegs = remindable.filter((r) => picked.has(r.id))

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allPicked = remindable.length > 0 && pickedRegs.length === remindable.length
  const queueRegs = queue ? remindable.filter((r) => queue.includes(r.id)) : []

  return (
    <div className="space-y-4">
      <Link to="/admin/payments" className="inline-flex items-center gap-1 text-sm font-medium text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All matches
      </Link>
      <div>
        <h1 className="text-2xl font-bold">{match.title}</h1>
        <p className="text-slate-600">{formatShortDate(match.match_date)}</p>
      </div>

      <>
              <PaymentInstructionsCard communityId={match.community_id} />
              <PaymentSummary matchId={match.id} />
              <SettleUpPanel match={match} />

              {queue && queueRegs.length > 0 && <ReminderQueue regs={queueRegs} match={match} onClose={() => { setQueue(null); setPicked(new Set()) }} />}

              {hasPayments(match) ? (
                <Card className="space-y-3 p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
                    <h2 className="font-semibold">Main list payments</h2>
                    <div className="flex gap-2" role="group" aria-label="Filter payments">
                      {(['ALL', 'UNPAID', 'PAID'] as const).map((f) => (
                        <Button key={f} size="sm" variant={filter === f ? 'default' : 'outline'} aria-pressed={filter === f} onClick={() => setFilter(f)}>
                          {f === 'ALL' ? 'All' : f === 'UNPAID' ? 'Unpaid' : 'Paid'}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {remindable.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 px-3">
                      <Button size="sm" variant="outline" onClick={() => setPicked(allPicked ? new Set() : new Set(remindable.map((r) => r.id)))}>
                        {allPicked ? 'Clear selection' : `Select all unpaid (${remindable.length})`}
                      </Button>
                      <Button size="sm" disabled={pickedRegs.length === 0} onClick={() => setQueue(pickedRegs.map((r) => r.id))}>
                        Send WhatsApp reminders ({pickedRegs.length})
                      </Button>
                    </div>
                  )}

                  {isShared(match) && main.some((r) => r.amount_due == null && r.payment_status === 'UNPAID') && (
                    <p className="px-3 text-sm text-slate-600">
                      Some players have no share yet. Add the expenses and calculate the shares (above) so they know what to pay.
                    </p>
                  )}
                  {regsError && (
                    <p role="alert" className="px-3 text-sm text-red-600">
                      {toFriendlyMessage(regsError)}
                    </p>
                  )}
                  {rows.length === 0 ? (
                    <p className="px-3 pb-3 text-sm text-slate-500">No players to show.</p>
                  ) : (
                    <ul className="divide-y divide-slate-100">
                      {rows.map((r) => {
                        const selectable = remindable.some((x) => x.id === r.id)
                        return (
                          <li key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-3">
                            {selectable ? (
                              <input
                                type="checkbox"
                                className="size-5 accent-green-700"
                                checked={picked.has(r.id)}
                                onChange={() => toggle(r.id)}
                                aria-label={`Select ${r.player?.full_name ?? 'player'} for a reminder`}
                              />
                            ) : (
                              <span className="w-5" aria-hidden />
                            )}
                            <span className="w-6 text-right text-slate-500">{r.list_position}.</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{r.player?.full_name ?? 'Unknown player'}</div>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                                <PaymentBadge status={r.payment_status} />
                                <span>{amountText(match, r)}</span>
                                {r.payment_method && <span>· {r.payment_method}</span>}
                                {r.payment_reference && <span>· Ref {r.payment_reference}</span>}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-start gap-2">
                              {canTrackPayment(match, r) && <PaymentActions reg={r} match={match} />}
                              <ReminderButton reg={r} match={match} lastAt={lastReminders?.[r.id]} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Card>
              ) : (
                <Card className="text-sm text-slate-600">This match is free, so there are no player payments to track.</Card>
              )}

              {refunds.length > 0 && (
                <Card className="space-y-2 p-0">
                  <h2 className="px-3 pt-3 font-semibold">Refunds due</h2>
                  <ul className="divide-y divide-slate-100">
                    {refunds.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                        <div>
                          <div className="font-medium">{r.player?.full_name ?? 'Unknown player'}</div>
                          <div className="text-sm text-slate-600">{r.payment_amount != null ? formatINR(r.payment_amount) : ''} paid, then cancelled</div>
                        </div>
                        <PaymentActions reg={r} match={match} />
                      </li>
                    ))}
                  </ul>
                </Card>
              )}

              <Button asChild variant="outline">
                <Link to={`/admin/matches/${match.id}`}>Open match management (expenses, lists)</Link>
              </Button>
      </>
    </div>
  )
}
