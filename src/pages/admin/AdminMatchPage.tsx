import { Pencil } from 'lucide-react'
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
import { availableStatusActions, type StatusAction } from '@/utils/matchStatus'

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

  const actions = availableStatusActions(match.status)

  return (
    <div className="space-y-4">
      <MatchDetails match={match} />

      <Card className="space-y-3">
        <h2 className="font-semibold">Manage</h2>
        <div className="flex flex-wrap gap-2">
          {match.status !== 'COMPLETED' && match.status !== 'CANCELLED' && (
            <Button asChild variant="outline">
              <Link to={`/admin/matches/${match.id}/edit`}>
                <Pencil className="size-4" aria-hidden /> Edit details
              </Link>
            </Button>
          )}
          {actions.map((a) => (
            <Button
              key={a.to}
              variant={a.destructive ? 'destructive' : a.to === 'OPEN' ? 'default' : 'outline'}
              onClick={() => {
                setActionError(null)
                setPending(a)
              }}
            >
              {a.label}
            </Button>
          ))}
        </div>
        {match.status === 'DRAFT' && <p className="text-sm text-slate-500">Draft matches are visible only to admins until you open registration.</p>}
      </Card>

      {match.status !== 'DRAFT' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Share match</h2>
          <ShareMatchButton match={match} />
        </Card>
      )}

      {match.status !== 'DRAFT' && (
        <Card className="space-y-3">
          <h2 className="font-semibold">Share player list</h2>
          <p className="text-sm text-slate-600">The current main list and waiting list, ready to post in your WhatsApp group.</p>
          <ShareListButton match={match} />
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
