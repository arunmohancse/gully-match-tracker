import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BrandLockup } from '@/components/BrandLockup'
import { InstagramLink } from '@/components/InstagramLink'
import { PartOfParent } from '@/components/ParentBrand'
import { FullPageSpinner } from '@/components/RouteGuards'
import { ThemeToggle } from '@/components/ThemeToggle'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from './AppLayout'
import { CricketLoader } from '@/components/CricketLoader'
import { CommunityLink } from '@/components/WhatsAppCommunity'

/** For pages that work both logged in (full app shell) and logged out (minimal shell), e.g. shared match links. */
export function ViewerLayout() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (session) return <AppLayout />

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-line bg-surface px-4 py-3">
        <span className="text-brand">
          <BrandLockup />
        </span>
        <span className="flex items-center gap-4 text-sm font-medium">
          <ThemeToggle className="-mr-2" />
          <Link to="/about" className="text-muted hover:underline">
            About
          </Link>
          <Link to="/login" className="text-brand underline">
            Log in
          </Link>
        </span>
      </header>
      <main className="mx-auto max-w-4xl p-4 md:p-8">
        <Suspense fallback={<CricketLoader label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="space-y-2 border-t border-line bg-surface py-4 text-center">
        <CommunityLink />
        <InstagramLink />
        <PartOfParent />
      </footer>
    </div>
  )
}
