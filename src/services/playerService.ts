import { MATCH_COLUMNS } from '@/lib/columns'
import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AccountStatus, PlayerSummary, RegistrationWithMatch, Role } from '@/types/domain'

interface ProfileRow {
  id: string
  full_name: string
  phone: string | null
  role: Role
  status: AccountStatus
  password_reset_until: string | null
  created_at: string
}

export const playerService = {
  /** Admin only: every profile with how many matches they have registered for. */
  async list(): Promise<PlayerSummary[]> {
    const profiles = (unwrap(await supabase.from('profiles').select('id, full_name, phone, role, status, password_reset_until, created_at').order('full_name')) ?? []) as ProfileRow[]
    const regs = (unwrap(await supabase.from('registrations').select('user_id')) ?? []) as { user_id: string }[]
    const counts = new Map<string, number>()
    for (const r of regs) counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1)
    return profiles.map((p) => ({ ...p, registration_count: counts.get(p.id) ?? 0 }))
  },

  /** Admin only. Promote a player to ADMIN or return an admin to USER. The database refuses changes to your own role. */
  async setRole(userId: string, role: Role): Promise<void> {
    unwrap(await supabase.rpc('set_user_role', { p_user_id: userId, p_role: role }))
  },

  /** Admin only. Approve a new signup, block a player, or unblock them. Blocking also ends their sessions. */
  async setStatus(userId: string, status: 'ACTIVE' | 'BLOCKED'): Promise<void> {
    unwrap(await supabase.rpc('admin_set_user_status', { p_user_id: userId, p_status: status }))
  },

  /** Admin only. Sets a temporary password; the player is signed out everywhere. */
  async setTempPassword(userId: string, password: string): Promise<void> {
    unwrap(await supabase.rpc('admin_set_temp_password', { p_user_id: userId, p_password: password }))
  },

  /** Admin only. Switches the player's own "reset password" on (open for 24 hours) or off. */
  async setPasswordReset(userId: string, enabled: boolean): Promise<void> {
    unwrap(await supabase.rpc('admin_set_password_reset', { p_user_id: userId, p_enabled: enabled }))
  },

  async history(userId: string): Promise<RegistrationWithMatch[]> {
    return (unwrap(
      await supabase.from('registrations').select(`*, match:matches(${MATCH_COLUMNS})`).eq('user_id', userId).order('registered_at', { ascending: false }),
    ) ?? []) as unknown as RegistrationWithMatch[]
  },
}
