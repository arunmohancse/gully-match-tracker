import { useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { GoogleButton } from '@/components/GoogleButton'
import { isInAppBrowser } from '@/utils/inAppBrowser'

/**
 * Google first; the email form stays tucked away behind a link until someone asks for it
 * (or Google can't work here, or the link has ?email=1).
 */
export function AuthMethods({ emailLabel, children }: { emailLabel: string; children: ReactNode }) {
  const [params] = useSearchParams()
  const [open, setOpen] = useState(() => params.get('email') === '1' || isInAppBrowser(navigator.userAgent))
  const showForm = open

  return (
    <div className="space-y-4">
      <GoogleButton />
      {showForm ? (
        <>
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-faint" aria-hidden>
            <span className="h-px flex-1 bg-line" />
            or
            <span className="h-px flex-1 bg-line" />
          </div>
          {children}
        </>
      ) : (
        <p className="text-center">
          <button type="button" className="min-h-11 w-full rounded-xl border border-line-strong text-sm font-bold hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand" aria-expanded={false} onClick={() => setOpen(true)}>
            {emailLabel}
          </button>
        </p>
      )}
    </div>
  )
}
