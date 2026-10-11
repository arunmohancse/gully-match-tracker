import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { toFriendlyMessage } from '@/lib/errors'
import { authService } from '@/services/authService'
import { isInAppBrowser } from '@/utils/inAppBrowser'

function GoogleLogo() {
  return (
    <svg viewBox="0 0 48 48" className="size-5 shrink-0" aria-hidden>
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.3 5.5-4.8 7.2l7.5 5.8c4.4-4.1 7.1-10.1 7.1-17.5z" />
      <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.5-5.8c-2.1 1.4-4.9 2.3-8.4 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
    </svg>
  )
}

/** "Continue with Google" for both log in and sign up; Supabase creates the account on first use. */
export function GoogleButton() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const inApp = isInAppBrowser(navigator.userAgent)

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

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setError('Could not copy the link. Open this page in Chrome or Safari instead.')
    }
  }

  return (
    <div className="space-y-2">
      <Button type="button" variant="outline" size="lg" className="w-full border-slate-400 font-semibold shadow-sm" loading={busy} onClick={onClick}>
        <GoogleLogo />
        {busy ? 'Opening Google...' : 'Continue with Google'}
      </Button>
      <p className="text-center text-xs text-slate-500">Fastest way in. No password to remember.</p>
      {inApp && (
        <div role="note" className="space-y-2 rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          <p>Google sign-in doesn't work inside WhatsApp or Instagram. Open this page in Chrome or Safari, or log in with email below.</p>
          <Button type="button" size="sm" variant="outline" onClick={copyLink}>
            {copied ? 'Link copied' : 'Copy link'}
          </Button>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
