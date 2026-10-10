import { Copy, Pencil } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AdminRegistrations } from '@/components/AdminRegistrations'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { ExpensesPanel } from '@/components/ExpensesPanel'
import { RegistrationPanel } from '@/components/RegistrationPanel'
import { PaymentSummary } from '@/components/PaymentSummary'
import { SettleUpPanel } from '@/components/SettleUpPanel'
import { MatchDetails } from '@/components/MatchDetails'
import { ShareListButton } from '@/components/ShareListButton'
import { ShareMatchButton } from '@/components/ShareMatchButton'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useChangeMatchStatus, useMatch } from '@/hooks/useMatches'
import { toFriendlyMessage } from '@/lib/errors'
import { LinkButton } from '@/components/ui/link-button'
import { cancelAction, nextStepAction, secondaryStatusActions, type StatusAction } from '@/utils/matchStatus'

export function AdminMatchPage() {
  const { id } = useParams()
  const { data: match, isLoading, error } = useMatch(id)
  const changeStatus = useChangeMatchStatus()
  const [pending, setPending] = useState<StatusAction | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (isLoading) return <p className="text-slate-500">Loading match...</p>
  if (error) {
    return (
      <p role="alert" className="text-red-600">
        {toFriendlyMessage(error)}
      </p>
    )
  }
  if (!match) return <p className="text-slate-600">Match not found.</p>

  async function confirm() {
    if (!pending || !match) return
    setActionError(null)
    try {
      await changeStatus.mutateAsync({ id: match.id, status: pending.to })
      setPending(null)
    } catch (e) {
      setActionError(toFriendlyMessage(e))
    }
  }

  const next = nextStepAction(match.status)
  const others = secondaryStatusActions(match.status)
  const cancel = cancelAction(match.status)
  const canEdit = match.status !== 'COMPLETED' && match.status !== 'CANCELLED'

  function ask(action: StatusAction) {
    setActionError(null)
    setPending(action)
  }

  return (
    <div className="space-y-4">
      <MatchDetails match={match} />

      <Card className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold">Manage</h2>
          {canEdit && (
            <Button asChild variant="ghost" className="size-11 p-0" title="Edit match">
              <Link to={`/admin/matches/${match.id}/edit`} aria-label="Edit match">
                <Pencil className="size-5" aria-hidden />
              </Link>
            </Button>
          )}
        </div>
        {/* One clear next step. A finished match has none, so the useful thing to do next is copy it. */}
        {next ? (
          <Button className="w-full" variant={next.to === 'OPEN' ? 'default' : 'outline'} onClick={() => ask(next)}>
            {next.label}
          </Button>
        ) : (
          <Button asChild className="w-full">
            <Link to={`/admin/matches/new?copy=${match.id}`}>
              <Copy className="size-4" aria-hidden /> Copy as new match
            </Link>
          </Button>
        )}
        {next && (
          <div className="flex flex-wrap items-center gap-x-4">
            <Link to={`/admin/matches/new?copy=${match.id}`} className="inline-flex min-h-11 items-center text-sm font-medium text-brand underline">
              Copy as new match
            </Link>
            {others.map((a) => (
              <LinkButton key={a.to} onClick={() => ask(a)}>
                {a.label}
              </LinkButton>
            ))}
          </div>
        )}
        {match.status === 'DRAFT' && <p className="text-sm text-slate-500">Draft matches are visible only to admins until you open registration.</p>}
      </Card>

      {match.status !== 'DRAFT' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Share</h2>
          <div className="space-y-1">
            <h3 className="text-sm text-slate-600">Match announcement</h3>
            <ShareMatchButton match={match} />
          </div>
          <div className="space-y-1 border-t border-slate-100 pt-3">
            <h3 className="text-sm text-slate-600">Player list (main and waiting list)</h3>
            <ShareListButton match={match} />
          </div>
        </Card>
      )}

      {/* Admins play too: same register / cancel panel that players see. */}
      {match.status !== 'DRAFT' && <RegistrationPanel match={match} />}

      {match.status !== 'DRAFT' && <PaymentSummary matchId={match.id} />}
      <ExpensesPanel matchId={match.id} />
      {match.status !== 'DRAFT' && <SettleUpPanel match={match} />}
      {match.status !== 'DRAFT' && <AdminRegistrations match={match} />}

      {match.status !== 'DRAFT' && (
        <Button asChild variant="outline" className="w-full sm:w-auto">
          <Link to={`/admin/payments/${match.id}`}>Open payments and reminders</Link>
        </Button>
      )}
      <Button asChild variant="outline" className="w-full sm:w-auto">
        <Link to={`/admin/activity?match=${match.id}`}>View activity for this match</Link>
      </Button>

      {cancel && (
        <Card className="space-y-2 border-red-200">
          <h2 className="font-semibold text-red-800">Danger zone</h2>
          <p className="text-sm text-slate-600">Cancelling cannot be undone. Players will see the match as cancelled.</p>
          <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50 sm:w-auto" onClick={() => ask(cancel)}>
            {cancel.label}
          </Button>
        </Card>
      )}

      <ConfirmDialog
        open={!!pending}
        onOpenChange={(open) => !open && setPending(null)}
        title={pending?.confirmTitle ?? ''}
        description={pending?.confirmBody ?? ''}
        confirmLabel={pending?.label ?? 'Confirm'}
        loadingLabel="Updating..."
        destructive={pending?.destructive}
        loading={changeStatus.isPending}
        error={actionError}
        onConfirm={confirm}
      />
    </div>
  )
}
