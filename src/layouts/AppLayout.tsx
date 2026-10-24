import { CalendarDays, CreditCard, LayoutDashboard, ListChecks, LogOut, User, Users } from 'lucide-react'
import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BrandLockup } from '@/components/BrandLockup'
import { InstagramLink } from '@/components/InstagramLink'
import { PartOfParent } from '@/components/ParentBrand'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { authService } from '@/services/authService'
import { CricketLoader } from '@/components/CricketLoader'

const USER_NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/matches', label: 'Matches', icon: CalendarDays },
  { to: '/my-registrations', label: 'My Registrations', icon: ListChecks },
  { to: '/profile', label: 'Profile', icon: User },
]

const ADMIN_NAV = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/matches', label: 'Matches', icon: CalendarDays },
  { to: '/admin/players', label: 'Players', icon: Users },
  { to: '/admin/payments', label: 'Payments', icon: CreditCard },
  { to: '/profile', label: 'Profile', icon: User },
]

export function AppLayout() {
  const { isAdmin, profile } = useAuth()
  const [signingOut, setSigningOut] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const nav = isAdmin ? ADMIN_NAV : USER_NAV

  async function handleSignOut() {
    setSigningOut(true)
    setError(null)
    try {
      await authService.signOut()
    } catch (e) {
      setError(toFriendlyMessage(e))
      setSigningOut(false)
    }
  }

  return (
    <div className="min-h-screen pb-24 md:pb-0 md:pl-56">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-surface focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-surface p-4 md:flex">
        <div className="mb-6 flex items-start justify-between gap-2 text-brand">
          <BrandLockup />
          <ThemeToggle className="-mr-2 shrink-0 text-fg" />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-2 rounded-lg px-3 py-2 text-sm', isActive ? 'bg-brand/10 font-bold text-brand' : 'font-medium hover:bg-surface-3')
              }
            >
              <Icon className="size-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-line pt-3 text-sm">
          <div className="space-y-1.5 pb-1 text-center">
            <NavLink to="/about" className="block text-xs text-subtle hover:text-brand hover:underline">
              About us
            </NavLink>
            <InstagramLink label="Instagram" />
            <PartOfParent />
          </div>
          <div className="truncate text-muted">
            {profile?.full_name}
            {isAdmin && ' (Admin)'}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} loading={signingOut}>
            <LogOut className="size-4" aria-hidden /> {signingOut ? 'Signing out...' : 'Sign out'}
          </Button>
          {error && (
            <p role="alert" className="text-danger">
              {error}
            </p>
          )}
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex h-15 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur md:hidden">
        <span className="text-brand">
          <BrandLockup />
        </span>
        <span className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="sm" onClick={handleSignOut} loading={signingOut} aria-label="Sign out">
            <LogOut className="size-4" aria-hidden />
          </Button>
        </span>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl p-4 outline-none md:p-8">
        {error && (
          <p role="alert" className="mb-3 text-sm text-danger md:hidden">
            {error}
          </p>
        )}
        <Suspense fallback={<CricketLoader label="Loading page" />}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('group flex flex-1 flex-col items-center gap-1 pb-2 pt-2.5 text-[11px]', isActive ? 'font-extrabold text-brand' : 'font-semibold text-subtle')
            }
          >
            <span className="flex h-7 w-14 items-center justify-center rounded-full group-aria-[current=page]:bg-brand/12">
              <Icon className="size-5" aria-hidden />
            </span>
            {label === 'My Registrations' ? 'Mine' : label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
