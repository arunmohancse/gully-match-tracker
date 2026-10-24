import { ArrowUpRight, MessageCircle } from 'lucide-react'
import type { ReactNode } from 'react'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

/** Outline Instagram glyph (lucide no longer ships brand icons). Decorative. */
function InstagramGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <rect x="3" y="3" width="18" height="18" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" />
    </svg>
  )
}

type SocialKind = 'whatsapp' | 'instagram'

interface Social {
  kind: SocialKind
  href: string
  title: string
  detail: string
  tile: string
  icon: (className: string) => ReactNode
}

/** The configured outside links, in display order. One with no link in config/brand.ts is left out. */
function socials(): Social[] {
  const list: Social[] = []
  if (brand.whatsappCommunity) {
    list.push({
      kind: 'whatsapp',
      href: brand.whatsappCommunity,
      title: 'WhatsApp community',
      detail: 'Match alerts and team chat',
      tile: 'bg-brand text-brand-foreground',
      icon: (c) => <MessageCircle className={c} aria-hidden />,
    })
  }
  const { handle, url } = brand.instagram
  if (handle && url) {
    list.push({
      kind: 'instagram',
      href: url,
      title: 'Instagram',
      detail: `@${handle}`,
      tile: 'bg-insta-soft text-insta',
      icon: (c) => <InstagramGlyph className={c} />,
    })
  }
  return list
}

/** One full-width tappable row: icon tile, name, handle or blurb, and an arrow that says it opens outside the app. */
function SocialRow({ social, compact }: { social: Social; compact?: boolean }) {
  return (
    <a
      href={social.href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'flex items-center gap-3 rounded-xl text-left text-fg hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand',
        compact ? 'min-h-10 px-2 py-1.5' : 'min-h-16 px-3 py-2',
      )}
    >
      <span className={cn('grid shrink-0 place-items-center', social.tile, compact ? 'size-7 rounded-lg' : 'size-11 rounded-xl')}>
        {social.icon(compact ? 'size-4' : 'size-5')}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className={cn('truncate', compact ? 'text-sm font-semibold' : 'font-extrabold')}>{social.title}</span>
        {!compact && <span className="truncate text-sm text-muted">{social.detail}</span>}
      </span>
      <ArrowUpRight className={cn('shrink-0 text-subtle', compact ? 'size-3.5' : 'size-4')} aria-hidden />
      <span className="sr-only">(opens in a new tab)</span>
    </a>
  )
}

/** "Stay in the loop" card with big rows for the WhatsApp community and Instagram. Nothing when neither is configured. */
export function SocialLinks({ only, className }: { only?: SocialKind; className?: string }) {
  const list = socials().filter((s) => !only || s.kind === only)
  if (!list.length) return null
  return (
    <section aria-labelledby={only ? undefined : 'stay-in-the-loop'} className={cn('rounded-2xl border border-line bg-surface p-1.5', className)}>
      {!only && (
        <h2 id="stay-in-the-loop" className="px-3 pb-1 pt-2.5 text-left text-xs font-extrabold uppercase tracking-[0.12em] text-muted">
          Stay in the loop
        </h2>
      )}
      <ul className="divide-y divide-line">
        {list.map((s) => (
          <li key={s.kind}>
            <SocialRow social={s} />
          </li>
        ))}
      </ul>
    </section>
  )
}

/** Smaller rows for the desktop sidebar, where there is less room. */
export function SocialLinksCompact({ className }: { className?: string }) {
  const list = socials()
  if (!list.length) return null
  return (
    <ul className={cn('space-y-0.5', className)} aria-label="Follow us">
      {list.map((s) => (
        <li key={s.kind}>
          <SocialRow social={s} compact />
        </li>
      ))}
    </ul>
  )
}
