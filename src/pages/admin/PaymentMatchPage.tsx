import { ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PaymentActions } from '@/components/PaymentActions'
import { PaymentInstructionsCard } from '@/components/PaymentInstructionsCard'
import { PaymentSummary } from '@/components/PaymentSummary'
import { PaymentBadge } from '@/components/RegistrationBadges'
import { ReminderButton, ReminderStamp } from '@/components/ReminderButton'
import { ReminderQueue } from '@/components/ReminderQueue'
import { SharePaymentsCard } from '@/components/SharePaymentsCard'
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
import { PageHeader } from '@/components/PageHeader'
import { Segmented } from '@/components/ui/segmented'
import { CricketLoader } from '@/components/CricketLoader'

type Filter = 'ALL' | 'UNPAID' | 'PAID'

export function PaymentMatchPage() {
  const { matchId = '' } = useParams()
  const { data: match, isLoading, error } = useMatch(matchId)
  const [filter, setFilter] = useState<Filter>('ALL')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const [queue, setQueue] = useState<string[] | null>(null)

  const { data: regs, error: regsError } = useAdminRegistrations(matchId)
  const { data: lastReminders } = useLastReminders(matchId)

  if (isLoading) return <CricketLoader label="Loading match" />
  if (error) {
    return (
      <p role="alert" className="text-danger">
        {toFriendlyMessage(error)}
      </p>
    )
  }

  if (!match) return <p className="text-muted">Match not found.</p>

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
      <Link to="/admin/payments" className="inline-flex min-h-10 items-center gap-1 text-sm font-bold text-brand hover:underline">
        <ArrowLeft className="size-4" aria-hidden /> All matches
      </Link>
      <PageHeader eyebrow={formatShortDate(match.match_date)} title={match.title} />

      <>
              <PaymentInstructionsCard communityId={match.community_id} />
              <PaymentSummary matchId={match.id} />
              <SettleUpPanel match={match} />
              <SharePaymentsCard match={match} />

              {queue && queueRegs.length > 0 && <ReminderQueue regs={queueRegs} match={match} onClose={() => { setQueue(null); setPicked(new Set()) }} />}

              {hasPayments(match) ? (
                <Card className="space-y-3 p-0">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-3 pt-3">
                    <h2 className="font-extrabold">Main list payments</h2>
                    <Segmented
                      label="Filter payments"
                      className="w-full sm:w-64"
                      value={filter}
                      onChange={setFilter}
                      options={[
                        { value: 'ALL', label: 'All' },
                        { value: 'UNPAID', label: 'Unpaid' },
                        { value: 'PAID', label: 'Paid' },
                      ]}
                    />
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
                    <p className="px-3 text-sm text-muted">
                      Some players have no share yet. Add the expenses and calculate the shares (above) so they know what to pay.
                    </p>
                  )}
                  {regsError && (
                    <p role="alert" className="px-3 text-sm text-danger">
                      {toFriendlyMessage(regsError)}
                    </p>
                  )}
                  {rows.length === 0 ? (
                    <p className="px-3 pb-3 text-sm text-subtle">No players to show.</p>
                  ) : (
                    <ul className="divide-y divide-line-soft">
                      {rows.map((r) => {
                        const selectable = remindable.some((x) => x.id === r.id)
                        return (
                          <li key={r.id} className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:gap-3">
                            <div className="flex min-w-0 flex-1 items-center gap-3">
                            {selectable ? (
                              <input
                                type="checkbox"
                                className="size-5 accent-brand"
                                checked={picked.has(r.id)}
                                onChange={() => toggle(r.id)}
                                aria-label={`Select ${r.player?.full_name ?? 'player'} for a reminder`}
                              />
                            ) : (
                              <span className="w-5" aria-hidden />
                            )}
                            <span className="w-6 text-right text-subtle">{r.list_position}.</span>
                            <div className="min-w-0 flex-1">
                              <div className="truncate font-medium">{r.player?.full_name ?? 'Unknown player'}</div>
                              <div className="flex flex-wrap items-center gap-2 text-sm text-muted">
                                <PaymentBadge status={r.payment_status} />
                                <span>{amountText(match, r)}</span>
                                {r.payment_method && <span>· {r.payment_method}</span>}
                                {r.payment_reference && <span>· Ref {r.payment_reference}</span>}
                                <ReminderStamp reg={r} match={match} lastAt={lastReminders?.[r.id]} />
                              </div>
                            </div>
                            </div>
                            {/* On phones the buttons sit on their own line under the name, lined up with it. */}
                            <div className="flex flex-wrap items-start gap-2 pl-[4.25rem] sm:pl-0">
                              {canTrackPayment(match, r) && <PaymentActions reg={r} match={match} />}
                              <ReminderButton reg={r} match={match} />
                            </div>
                          </li>
                        )
                      })}
                    </ul>
                  )}
                </Card>
              ) : (
                <Card className="text-sm text-muted">This match is free, so there are no player payments to track.</Card>
              )}

              {refunds.length > 0 && (
                <Card className="space-y-2 p-0">
                  <h2 className="px-3 pt-3 font-extrabold">Refunds due</h2>
                  <ul className="divide-y divide-line-soft">
                    {refunds.map((r) => (
                      <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-3">
                        <div>
                          <div className="font-medium">{r.player?.full_name ?? 'Unknown player'}</div>
                          <div className="text-sm text-muted">{r.payment_amount != null ? formatINR(r.payment_amount) : ''} paid, then cancelled</div>
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
