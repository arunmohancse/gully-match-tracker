import { MessageCircle, X } from 'lucide-react'
import { useState } from 'react'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

const DISMISSED_KEY = 'community-card-dismissed'

function readDismissed() {
  try {
    return localStorage.getItem(DISMISSED_KEY) === '1'
  } catch {
    return false // storage blocked (private mode, in-app browsers): just show the card
  }
}

function saveDismissed() {
  try {
    localStorage.setItem(DISMISSED_KEY, '1')
  } catch {
    // hidden for this visit only
  }
}

/** Small "Join our WhatsApp community" link, for footers next to the Instagram link. Nothing when no link is configured. */
export function CommunityLink({ label = 'Join our WhatsApp community', className }: { label?: string; className?: string }) {
  if (!brand.whatsappCommunity) return null
  return (
    <a
      href={brand.whatsappCommunity}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-subtle hover:text-brand hover:underline', className)}
    >
      <MessageCircle className="size-4 shrink-0" aria-hidden />
      {label}
    </a>
  )
}

/**
 * Invite card. With `dismissible` (dashboards) it has a close button and hides for good on this device once
 * closed or once Join is tapped; the footer link stays for later.
 */
export function JoinCommunityCard({ dismissible, title, text, className }: { dismissible?: boolean; title?: string; text?: string; className?: string }) {
  const [hidden, setHidden] = useState(() => dismissible && readDismissed())
  if (!brand.whatsappCommunity || hidden) return null

  function dismiss() {
    if (!dismissible) return
    saveDismissed()
    setHidden(true)
  }

  return (
    <section aria-labelledby="join-community" className={cn('relative flex items-start gap-3 rounded-2xl border border-success-line bg-success-soft p-4', className)}>
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-brand-foreground" aria-hidden>
        <MessageCircle className="size-5" />
      </span>
      <div className={cn('min-w-0 flex-1 space-y-2', dismissible && 'pr-6')}>
        <div>
          <h2 id="join-community" className="font-extrabold">
            {title ?? `Join the ${brand.name} WhatsApp community`}
          </h2>
          <p className="text-sm text-muted">{text ?? 'Match announcements, registration alerts and team chat, all in one place.'}</p>
        </div>
        <a
          href={brand.whatsappCommunity}
          target="_blank"
          rel="noopener noreferrer"
          onClick={dismiss}
          className="inline-flex h-10 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-brand-foreground hover:bg-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MessageCircle className="size-4" aria-hidden /> Join on WhatsApp
        </a>
      </div>
      {dismissible && (
        <button
          type="button"
          onClick={dismiss}
          aria-label="Hide, I've already joined"
          title="I've already joined"
          className="absolute right-2 top-2 grid size-9 place-items-center rounded-full text-subtle hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </section>
  )
}
