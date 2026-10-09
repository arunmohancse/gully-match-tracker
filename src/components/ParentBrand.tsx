import { brand } from '@/config/brand'
import { cn } from '@/lib/utils'

/** The parent community's logo (or its name as text when there is no logo). */
export function ParentLogo({ className }: { className?: string }) {
  const { name, logoSrc } = brand.parent
  if (!logoSrc) return <span className="font-semibold">{name}</span>
  return <img src={logoSrc} alt={name} className={cn('h-7 w-auto', className)} />
}

/** Small "Part of [Playfest]" mark for page and sidebar footers. */
export function PartOfParent({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center gap-2 text-xs text-slate-500', className)}>
      <span>Part of</span>
      <ParentLogo className="h-6" />
    </div>
  )
}
