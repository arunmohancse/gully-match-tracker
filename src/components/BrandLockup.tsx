import { BrandLogo } from '@/components/BrandLogo'
import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

/** Logo plus the club name, with the place name small underneath: "GULLY LEAGUE / TRIVANDRUM". */
export function BrandLockup({ large, className }: { large?: boolean; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <BrandLogo className={large ? 'size-12 text-4xl' : undefined} />
      <span className="flex flex-col text-left leading-tight">
        <span className={cn('font-display font-bold uppercase tracking-wide', large ? 'text-3xl' : 'text-[21px] leading-none')}>{brand.name}</span>
        {brand.subtitle && (
          <span className={cn('font-bold uppercase tracking-[0.2em] text-subtle', large ? 'text-xs' : 'text-[10px]')}>{brand.subtitle}</span>
        )}
      </span>
    </span>
  )
}
