import { CalendarDays, CreditCard, LayoutDashboard, ListChecks, LogOut, User, Users } from 'lucide-react'
import { Suspense, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { BrandLockup } from '@/components/BrandLockup'
import { PartOfParent } from '@/components/ParentBrand'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/useAuth'
import { toFriendlyMessage } from '@/lib/errors'
import { cn } from '@/lib/utils'
import { authService } from '@/services/authService'

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
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2 focus:shadow">
        Skip to content
      </a>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-slate-200 bg-white p-4 md:flex">
        <div className="mb-6 text-brand">
          <BrandLockup />
        </div>
        <nav className="flex flex-1 flex-col gap-1" aria-label="Main">
          {nav.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                cn('flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium', isActive ? 'bg-brand/10 text-brand' : 'hover:bg-slate-100')
              }
            >
              <Icon className="size-4" aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
          <PartOfParent className="pb-1" />
          <div className="truncate text-slate-600">
            {profile?.full_name}
            {isAdmin && ' (Admin)'}
          </div>
          <Button variant="outline" size="sm" className="w-full" onClick={handleSignOut} loading={signingOut}>
            <LogOut className="size-4" aria-hidden /> {signingOut ? 'Signing out...' : 'Sign out'}
          </Button>
          {error && (
            <p role="alert" className="text-red-600">
              {error}
            </p>
          )}
        </div>
      </aside>

      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden">
        <span className="text-brand">
          <BrandLockup />
        </span>
        <Button variant="ghost" size="sm" onClick={handleSignOut} loading={signingOut} aria-label="Sign out">
          <LogOut className="size-4" aria-hidden />
        </Button>
      </header>

      <main id="main" tabIndex={-1} className="mx-auto max-w-4xl p-4 outline-none md:p-8">
        {error && (
          <p role="alert" className="mb-3 text-sm text-red-600 md:hidden">
            {error}
          </p>
        )}
        <Suspense fallback={<p className="text-slate-500">Loading...</p>}>
          <Outlet />
        </Suspense>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 flex border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden" aria-label="Main">
        {nav.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn('flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium', isActive ? 'text-brand' : 'text-slate-500')
            }
          >
            <Icon className="size-5" aria-hidden />
            {label === 'My Registrations' ? 'Mine' : label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
