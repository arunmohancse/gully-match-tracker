import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export interface PaymentSettings {
  /** Free-text "how to pay". */
  instructions: string
  /** UPI id (name@bank) used to build pay links and QR codes. Empty when not set. */
  upiId: string
  /** Name shown in the payer's UPI app. */
  payeeName: string
}

interface Row {
  payment_instructions: string | null
  upi_id: string | null
  upi_payee_name: string | null
}

export const communityService = {
  /** Where / how to pay. Readable by logged-in users, writable by admins only (RLS). */
  async getPaymentSettings(communityId: string): Promise<PaymentSettings> {
    const row = unwrap(
      await supabase.from('communities').select('payment_instructions, upi_id, upi_payee_name').eq('id', communityId).maybeSingle(),
    ) as Row | null
    return { instructions: row?.payment_instructions ?? '', upiId: row?.upi_id ?? '', payeeName: row?.upi_payee_name ?? '' }
  },

  async savePaymentSettings(communityId: string, s: PaymentSettings): Promise<void> {
    unwrap(
      await supabase
        .from('communities')
        .update({ payment_instructions: s.instructions.trim() || null, upi_id: s.upiId.trim() || null, upi_payee_name: s.payeeName.trim() || null })
        .eq('id', communityId),
    )
  },
}
