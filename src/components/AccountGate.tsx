import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { InstagramLink } from '@/components/InstagramLink'
import { BrandLockup } from '@/components/BrandLockup'
import { useAuth } from '@/hooks/useAuth'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'

/** Shown instead of the app to accounts that are waiting for approval or have been blocked. UX only; the database enforces it. */
export function AccountGate({ status }: { status: 'PENDING' | 'BLOCKED' }) {
  const { refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const pending = status === 'PENDING'

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (e) {
      setError(toFriendlyMessage(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="grid min-h-screen place-items-center p-4">
      <Card className="w-full max-w-sm space-y-4 p-6 text-center">
        <div className="flex justify-center text-brand">
          <BrandLockup large />
        </div>
        <h1 className="text-xl font-bold">{pending ? 'Waiting for approval' : 'Account blocked'}</h1>
        <p className="text-sm text-slate-600">
          {pending
            ? 'Thanks for signing up. An admin needs to approve your account before you can register for matches. Check back soon.'
            : 'Your account has been blocked. Please contact the organiser if you think this is a mistake.'}
        </p>
        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}
        {pending && <InstagramLink label="While you wait, follow us on Instagram" />}
        <div className="flex flex-col gap-2">
          {pending && (
            <Button onClick={() => run(refreshProfile)} loading={busy}>
              {busy ? 'Checking...' : 'Check again'}
            </Button>
          )}
          <Button variant="outline" onClick={() => run(authService.signOut)} disabled={busy}>
            Sign out
          </Button>
        </div>
      </Card>
    </div>
  )
}
