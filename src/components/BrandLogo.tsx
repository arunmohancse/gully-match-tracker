import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

/** The club logo (image) or, when none is configured, the fallback emoji. Decorative: the name is always shown beside it. */
export function BrandLogo({ className }: { className?: string }) {
  if (brand.logoSrc) {
    return <img src={brand.logoSrc} alt="" className={cn('size-8 shrink-0 rounded object-contain', className)} />
  }
  return (
    <span className={cn('shrink-0 text-xl leading-none', className)} aria-hidden>
      {brand.emoji}
    </span>
  )
}
