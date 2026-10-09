import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { AccountGate } from '@/components/AccountGate'
import { useAuth } from '@/hooks/useAuth'

export function FullPageSpinner() {
  return <div className="grid min-h-screen place-items-center text-slate-500">Loading...</div>
}

/** UX guard only. Authorization is enforced by Supabase RLS/RPCs. */
export function RequireAuth() {
  const { session, loading, profile } = useAuth()
  const location = useLocation()
  if (loading) return <FullPageSpinner />
  if (!session) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
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
