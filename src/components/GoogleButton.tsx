import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'

/** "Continue with Google" for both log in and sign up; Supabase creates the account on first use. */
export function GoogleButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function onClick() {
    setBusy(true)
    setError(null)
    try {
      await authService.signInWithGoogle()
    } catch (err) {
      setError(toFriendlyMessage(err))
      setBusy(false)
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" className="w-full" loading={busy} onClick={onClick}>
        {busy ? 'Opening Google...' : 'Continue with Google'}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <p className="text-center text-xs text-slate-500">If Google won't open from WhatsApp or Instagram, open this page in Chrome or Safari.</p>
      <p className="text-center text-xs uppercase tracking-wide text-slate-400">or</p>
    </div>
  )
}
