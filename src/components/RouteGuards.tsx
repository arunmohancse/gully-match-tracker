import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AccountGate } from '@/components/AccountGate'
import { PhoneGate } from '@/components/PhoneGate'
import { useAuth } from '@/hooks/useAuth'
import { CricketLoader } from '@/components/CricketLoader'

export function FullPageSpinner() {
  return <CricketLoader fullScreen label="Loading Gully League" />
}

/** UX guard only. Authorization is enforced by Supabase RLS/RPCs. */
export function RequireAuth() {
  const { session, loading, profile } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  // Logged-out visitors opening the site's home address see the public About page; everything else asks them to log in.
  if (!session && location.pathname === '/') return <Navigate to="/about" replace />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  if (profile && profile.status !== 'BLOCKED' && !profile.phone) return <PhoneGate />
  if (profile?.status === 'PENDING' || profile?.status === 'BLOCKED') return <AccountGate status={profile.status} />
  return <Outlet />
}

export function RequireAdmin() {
  const { isAdmin } = useAuth()
  return isAdmin ? <Outlet /> : <Navigate to="/" replace />
}

/** Sends logged-in users away from /login and /signup. */
export function RedirectIfAuthed() {
  const { session, loading, isAdmin } = useAuth()
  if (loading) return <FullPageSpinner />
  if (session) return <Navigate to={isAdmin ? '/admin' : '/'} replace />
  return <Outlet />
}
