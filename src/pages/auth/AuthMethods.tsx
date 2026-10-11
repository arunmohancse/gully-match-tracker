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
          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-slate-400" aria-hidden>
            <span className="h-px flex-1 bg-slate-200" />
            or
            <span className="h-px flex-1 bg-slate-200" />
          </div>
          {children}
        </>
      ) : (
        <p className="text-center">
          <button type="button" className="text-sm font-medium text-brand underline" aria-expanded={false} onClick={() => setOpen(true)}>
            {emailLabel}
          </button>
        </p>
      )}
    </div>
  )
}
