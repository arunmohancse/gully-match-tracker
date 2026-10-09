import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export const communityService = {
  /** Where / how to pay (for example a UPI id). Readable by logged-in users, writable by admins only (RLS). */
  async getPaymentInstructions(communityId: string): Promise<string> {
    const row = unwrap(await supabase.from('communities').select('payment_instructions').eq('id', communityId).maybeSingle()) as
      | { payment_instructions: string | null }
      | null
    return row?.payment_instructions ?? ''
  },

  async savePaymentInstructions(communityId: string, text: string): Promise<void> {
    unwrap(await supabase.from('communities').update({ payment_instructions: text.trim() || null }).eq('id', communityId))
  },
}
