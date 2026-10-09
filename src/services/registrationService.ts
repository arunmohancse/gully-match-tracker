import { MATCH_COLUMNS } from '@/lib/columns'
import { AppError, isNetworkError, toFriendlyMessage, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { AdminRegistration, ListType, MatchCounts, Registration, RegistrationWithMatch, RosterEntry } from '@/types/domain'

const RPC_TIMEOUT_MS = 15_000

export interface RegisterResult {
  registration_id: string
  match_id: string
  list_type: Registration['list_type']
  list_position: number | null
  payment_status: Registration['payment_status']
  already_registered: boolean
}

export const registrationService = {
  /** The caller's own registration for a match (null if never registered). Filters by user so admins get theirs too. */
  async getMine(matchId: string, userId: string): Promise<Registration | null> {
    return unwrap(
      await supabase.from('registrations').select('*').eq('match_id', matchId).eq('user_id', userId).maybeSingle(),
    ) as Registration | null
  },

  async listMine(userId: string): Promise<RegistrationWithMatch[]> {
    const rows = unwrap(
      await supabase.from('registrations').select(`*, match:matches(${MATCH_COLUMNS})`).eq('user_id', userId).order('registered_at', { ascending: false }),
    ) as unknown as RegistrationWithMatch[] | null
    return rows ?? []
  },

  /**
   * Atomic server-side registration. If the request times out or the connection drops, the server may
   * still have committed it, so we check before reporting failure (the RPC is also idempotent).
   */
  async register(matchId: string, userId: string): Promise<RegisterResult> {
    const { data, error } = await supabase
      .rpc('register_for_match', { p_match_id: matchId })
      .abortSignal(AbortSignal.timeout(RPC_TIMEOUT_MS))

    if (error) {
      if (isNetworkError(error)) {
        const existing = await registrationService.getMine(matchId, userId).catch(() => null)
        if (existing?.status === 'ACTIVE') {
          return {
            registration_id: existing.id,
            match_id: existing.match_id,
            list_type: existing.list_type,
            list_position: existing.list_position,
            payment_status: existing.payment_status,
            already_registered: true,
          }
        }
      }
      throw new AppError(toFriendlyMessage(error))
    }
    const row = (data as RegisterResult[] | null)?.[0]
    if (!row) throw new AppError(toFriendlyMessage(null))
    return row
  },

  /** Cancels a registration (own, or any as admin). Idempotent. */
  async cancel(registrationId: string): Promise<{ promoted_count: number }> {
    const rows = unwrap(await supabase.rpc('cancel_registration', { p_registration_id: registrationId })) as { promoted_count: number }[] | null
    return rows?.[0] ?? { promoted_count: 0 }
  },

  /** Admin: every registration for a match with player contact details (RLS rejects non-admins). */
  async adminList(matchId: string): Promise<AdminRegistration[]> {
    const rows = unwrap(
      await supabase.from('registrations').select('*, player:profiles(full_name, phone)').eq('match_id', matchId).order('seq'),
    ) as AdminRegistration[] | null
    return rows ?? []
  },

  /** Admin: move to the other list. Use `swapWith` (a main-list registration id) to promote when the main list is full. */
  async adminMove(registrationId: string, target: ListType, swapWith?: string): Promise<void> {
    unwrap(
      await supabase.rpc('admin_move_registration', {
        p_registration_id: registrationId,
        p_target_list: target,
        p_swap_with: swapWith ?? null,
      }),
    )
  },

  async roster(matchId: string): Promise<RosterEntry[]> {
    return (unwrap(await supabase.rpc('get_match_roster', { p_match_id: matchId })) ?? []) as RosterEntry[]
  },

  async counts(matchIds: string[]): Promise<MatchCounts[]> {
    if (matchIds.length === 0) return []
    return (unwrap(await supabase.rpc('get_match_counts', { p_match_ids: matchIds })) ?? []) as MatchCounts[]
  },
}
