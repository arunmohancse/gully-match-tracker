import { MATCH_COLUMNS } from '@/lib/columns'
import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AccountStatus, PlayerSummary, RegistrationWithMatch, Role } from '@/types/domain'

export const PLAYERS_PAGE_SIZE = 50

export interface PlayerFilters {
  query: string
  status: AccountStatus | null
}

export interface PlayerPage {
  players: PlayerSummary[]
  /** Players matching the filters, across all pages. */
  total: number
}

export interface PlayerCounts {
  total: number
  pending: number
  blocked: number
}

interface ListRow {
  id: string
  full_name: string
  phone: string | null
  role: Role
  status: AccountStatus
  password_reset_until: string | null
  created_at: string
  registration_count: number
  total_count: number
}

export const playerService = {
  /** Admin only: one page of players (searched and filtered in the database) with their registration counts. */
  async list(filters: PlayerFilters, offset: number): Promise<PlayerPage> {
    const rows = (unwrap(
      await supabase.rpc('admin_list_players', {
        p_query: filters.query.trim() || null,
        p_status: filters.status,
        p_limit: PLAYERS_PAGE_SIZE,
        p_offset: offset,
      }),
    ) ?? []) as ListRow[]
    return {
      players: rows.map(({ total_count: _total, ...p }) => ({ ...p, registration_count: Number(p.registration_count) })),
      total: rows.length ? Number(rows[0].total_count) : 0,
    }
  },

  /** Admin only: totals for the filter buttons. */
  async counts(): Promise<PlayerCounts> {
    const rows = (unwrap(await supabase.rpc('admin_player_counts')) ?? []) as { total_count: number; pending_count: number; blocked_count: number }[]
    const r = rows[0]
    return { total: Number(r?.total_count ?? 0), pending: Number(r?.pending_count ?? 0), blocked: Number(r?.blocked_count ?? 0) }
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
