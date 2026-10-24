import type { ReactNode } from 'react'
import { BrandLogo } from '@/components/BrandLogo'
import { InstagramLink } from '@/components/InstagramLink'
import { ParentLogo } from '@/components/ParentBrand'
import { ThemeToggle } from '@/components/ThemeToggle'
import { brand } from '@/config/brand'
import { CommunityLink } from '@/components/WhatsAppCommunity'

/** Login / sign-up / reset: the club on the striped pitch up top, the form on a card that overlaps it. */
export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="relative bg-pitch px-6 pb-14 pt-10 text-center text-on-pitch sm:pt-14">
        <ThemeToggle className="absolute right-3 top-3 text-white hover:bg-white/10" />
        <BrandLogo className="mx-auto size-24 text-6xl" />
        <p className="mt-3 font-display text-[44px] font-bold uppercase leading-[0.95] tracking-wide">{brand.name}</p>
        {brand.subtitle && <p className="mt-1 text-xs font-extrabold uppercase tracking-[0.3em] text-stumps">{brand.subtitle}</p>}
        {brand.tagline && (
          <p className="mt-3 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm font-semibold text-on-pitch-muted">
            <span>{brand.taglineLead}</span>
            <ParentLogo className="h-8" />
          </p>
        )}
      </header>

      <main className="-mt-7 flex-1 rounded-t-[28px] bg-surface px-6 pb-8 pt-7 sm:mx-auto sm:mb-10 sm:w-full sm:max-w-md sm:flex-none sm:rounded-[28px] sm:border sm:border-line sm:shadow-sm">
        <div className="mx-auto max-w-sm space-y-4">
          <h1 className="font-display text-3xl font-bold leading-none">{title}</h1>
          {children}
          <div className="flex flex-col items-center gap-2 pt-2">
            <CommunityLink />
            <InstagramLink />
          </div>
        </div>
      </main>
    </div>
  )
}
