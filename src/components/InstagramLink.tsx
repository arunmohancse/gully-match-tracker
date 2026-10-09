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

/** "Follow us on Instagram @handle" as a link that opens in a new tab. Renders nothing if no Instagram page is configured. */
export function InstagramLink({ label = 'Follow us on Instagram', className }: { label?: string; className?: string }) {
  const { handle, url } = brand.instagram
  if (!handle || !url) return null
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn('inline-flex items-center justify-center gap-1.5 text-xs text-slate-500 hover:text-brand hover:underline', className)}
    >
      <InstagramGlyph className="size-4 shrink-0" />
      <span>
        {label} <span className="font-semibold">@{handle}</span>
      </span>
    </a>
  )
}
