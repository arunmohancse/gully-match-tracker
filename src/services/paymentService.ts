import { AppError, toFriendlyMessage, unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'
import type { MatchFinancials, PaymentStatus, SharesResult } from '@/types/domain'

export interface SetPaymentInput {
  registrationId: string
  status: PaymentStatus
  amount?: number | null
  reference?: string | null
  method?: string | null
  notes?: string | null
}

export const paymentService = {
  /** Admin only (enforced in the database). Marking PAID with no amount records the match fee. */
  async setPayment(input: SetPaymentInput): Promise<void> {
    unwrap(
      await supabase.rpc('admin_set_payment', {
        p_registration_id: input.registrationId,
        p_status: input.status,
        p_amount: input.amount ?? null,
        p_reference: input.reference ?? null,
        p_method: input.method ?? null,
        p_notes: input.notes ?? null,
      }),
    )
  },

  /** Admin only: split the total expenses equally among the main-list players, rounded up to a multiple of `step`. */
  async finalizeShares(matchId: string, step: number): Promise<SharesResult> {
    const rows = unwrap(await supabase.rpc('finalize_match_shares', { p_match_id: matchId, p_step: step })) as SharesResult[] | null
    const row = rows?.[0]
    if (!row) throw new AppError(toFriendlyMessage(null))
    return row
  },

  async financials(matchIds: string[]): Promise<MatchFinancials[]> {
    if (matchIds.length === 0) return []
    return (unwrap(await supabase.rpc('match_financials', { p_match_ids: matchIds })) ?? []) as MatchFinancials[]
  },
}
