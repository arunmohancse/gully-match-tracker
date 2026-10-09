import { Check } from 'lucide-react'
import { useState } from 'react'
import { RegistrationNote } from '@/components/RegistrationNote'
import { PlayerPaymentInfo } from '@/components/PlayerPaymentInfo'
import { CancelledBadge, ListBadge } from '@/components/RegistrationBadges'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { useCancelRegistration, useMyRegistration, useRegister } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import type { Match } from '@/types/domain'
import { registrationWindow } from '@/utils/registration'

/** The signed-in player's registration state for a match, plus the Register action. */
export function RegistrationPanel({ match }: { match: Match }) {
  const { data: mine, isLoading, error: loadError } = useMyRegistration(match.id)
  const register = useRegister(match.id)
  const cancel = useCancelRegistration()
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  if (isLoading) return <Card className="text-slate-500">Checking your registration...</Card>
  if (loadError) {
    return (
      <Card role="alert" className="text-red-600">
        {toFriendlyMessage(loadError)}
      </Card>
    )
  }

  async function onRegister() {
    if (register.isPending) return
    setError(null)
    setNotice(null)
    try {
      const result = await register.mutateAsync()
      if (result.already_registered) setNotice('You were already registered.')
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  async function onCancel(registrationId: string) {
    setError(null)
    setNotice(null)
    try {
      await cancel.mutateAsync(registrationId)
      setConfirmOpen(false)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  const active = mine?.status === 'ACTIVE' ? mine : null
  const window = registrationWindow(match)
  const full = match.status === 'FULL'

  if (active) {
    const main = active.list_type === 'MAIN_LIST'
    return (
      <Card className="space-y-3 border-green-300 bg-green-50">
        <div className="flex items-center gap-2 font-semibold text-green-800">
          <Check className="size-5" aria-hidden /> You are registered
        </div>
        <ListBadge listType={active.list_type} position={active.list_position} />
        {notice && <p role="status" className="text-sm text-green-800">{notice}</p>}
        <PlayerPaymentInfo match={match} reg={active} />
        <RegistrationNote match={match} />
        {!main && <p className="text-sm text-slate-600">If a main-list spot opens up, you will be moved up automatically.</p>}
        {window === 'OPEN' ? (
          <Button variant="outline" className="w-full border-red-300 text-red-700 hover:bg-red-50" onClick={() => { setError(null); setConfirmOpen(true) }}>
            Cancel registration
          </Button>
        ) : (
          <p className="text-xs text-slate-500">Registration is closed. Contact the organiser if you can no longer play.</p>
        )}
        <ConfirmDialog
          open={confirmOpen}
          onOpenChange={setConfirmOpen}
          title="Cancel your registration?"
          description={
            main
              ? 'You will give up your main-list spot. The first player on the waiting list will take it. If you register again later you will join the back of the queue.'
              : 'You will leave the waiting list. If you register again later you will join the back of the queue.'
          }
          confirmLabel="Cancel registration"
          loadingLabel="Cancelling..."
          cancelLabel="Keep my spot"
          destructive
          loading={cancel.isPending}
          error={error}
          onConfirm={() => onCancel(active.id)}
        />
        {error && !confirmOpen && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
      </Card>
    )
  }

  const canRegister = window === 'OPEN'
  return (
    // When the Register button is available it floats just above the bottom navigation on phones.
    <Card className={canRegister ? 'sticky bottom-20 z-10 space-y-3 shadow-lg md:static md:shadow-sm' : 'space-y-3'}>
      {mine?.status === 'CANCELLED' && (
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <CancelledBadge /> You cancelled your registration.
        </div>
      )}
      {canRegister ? (
        <>
          <RegistrationNote match={match} />
          {full && <p className="text-sm text-orange-700">The main list is full. You will join the waiting list.</p>}
          <Button size="lg" className="w-full" onClick={onRegister} loading={register.isPending}>
            {register.isPending ? 'Registering...' : full ? 'Join waiting list' : 'Register'}
          </Button>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          {match.status === 'CANCELLED'
            ? 'This match has been cancelled.'
            : window === 'NOT_YET'
              ? "Registration hasn't opened yet."
              : 'Registration is currently closed.'}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </Card>
  )
}
