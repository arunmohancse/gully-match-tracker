import type { ReactNode } from 'react'
import { BrandLockup } from '@/components/BrandLockup'
import { InstagramLink } from '@/components/InstagramLink'
import { ParentLogo } from '@/components/ParentBrand'
import { Card } from '@/components/ui/card'
import { brand } from '@/config/brand'

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen place-items-center p-4">
      <div className="w-full max-w-sm space-y-4">
      <Card className="space-y-4 p-6">
        <div className="text-center">
          <div className="mb-1 flex justify-center text-brand">
            <BrandLockup large />
          </div>
          {brand.tagline && (
            <p className="mt-1 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-slate-500">
              <span>{brand.taglineLead}</span>
              <ParentLogo className="h-8" />
            </p>
          )}
          <h1 className="mt-3 text-xl font-bold">{title}</h1>
        </div>
        {children}
      </Card>
      <div className="text-center">
        <InstagramLink />
      </div>
      </div>
    </div>
  )
}
