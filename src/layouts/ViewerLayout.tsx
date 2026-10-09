import { Suspense } from 'react'
import { Link, Outlet } from 'react-router-dom'
import { BrandLockup } from '@/components/BrandLockup'
import { InstagramLink } from '@/components/InstagramLink'
import { PartOfParent } from '@/components/ParentBrand'
import { FullPageSpinner } from '@/components/RouteGuards'
import { useAuth } from '@/hooks/useAuth'
import { AppLayout } from './AppLayout'

/** For pages that work both logged in (full app shell) and logged out (minimal shell), e.g. shared match links. */
export function ViewerLayout() {
  const { session, loading } = useAuth()
  if (loading) return <FullPageSpinner />
  if (session) return <AppLayout />

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3">
        <span className="text-brand">
          <BrandLockup />
        </span>
        <span className="flex items-center gap-4 text-sm font-medium">
          <Link to="/about" className="text-slate-600 hover:underline">
            About
          </Link>
          <Link to="/login" className="text-brand underline">
            Log in
          </Link>
        </span>
      </header>
      <main className="mx-auto max-w-4xl p-4 md:p-8">
        <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="space-y-2 border-t border-slate-200 bg-white py-4 text-center">
        <InstagramLink />
        <PartOfParent />
      </footer>
    </div>
  )
}
