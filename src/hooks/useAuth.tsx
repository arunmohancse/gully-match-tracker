import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from '@/lib/supabase'
import { authService } from '@/services/authService'
import type { Profile } from '@/types/domain'

interface AuthState {
  session: Session | null
  profile: Profile | null
  loading: boolean
  isAdmin: boolean
  refreshProfile: () => Promise<void>
  setProfile: (p: Profile) => void
}

const AuthContext = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [sessionKnown, setSessionKnown] = useState(false)
  const [profileLoadedFor, setProfileLoadedFor] = useState<string | null>(null)

  useEffect(() => {
    // Also fires on tab focus and token refresh, so it must only record the session.
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
      setSessionKnown(true)
      if (!next) setProfile(null)
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = session?.user.id
  useEffect(() => {
    if (!userId) return
    let cancelled = false
    authService
      .getProfile(userId)
      .then((p) => !cancelled && setProfile(p))
      .catch(() => !cancelled && setProfile(null))
      .finally(() => !cancelled && setProfileLoadedFor(userId))
    return () => {
      cancelled = true
    }
  }, [userId])

  // Derived, so it can never get stuck: loading only while the session or the current user's profile is unresolved.
  const loading = !sessionKnown || (!!userId && profileLoadedFor !== userId)

  const value = useMemo<AuthState>(
    () => ({
      session,
      profile,
      loading,
      // UI convenience only. Real authorization is enforced by RLS/RPCs.
      isAdmin: profile?.role === 'ADMIN',
      setProfile,
      refreshProfile: async () => {
        if (userId) setProfile(await authService.getProfile(userId))
      },
    }),
    [session, profile, loading, userId],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
