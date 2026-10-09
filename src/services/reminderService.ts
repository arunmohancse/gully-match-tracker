import { unwrap } from '@/lib/errors'
import { supabase } from '@/lib/supabase'

export const reminderService = {
  /** Records that an admin opened a reminder chat (admin only; Click-to-Chat cannot confirm it was sent). */
  async logOpened(registrationId: string): Promise<void> {
    unwrap(await supabase.rpc('log_reminder_opened', { p_registration_id: registrationId }))
  },

  /** Latest reminder time per registration for a match (admin only, read from the audit log). */
  async lastForMatch(matchId: string): Promise<Record<string, string>> {
    const rows = (unwrap(
      await supabase
        .from('audit_logs')
        .select('entity_id, created_at')
        .eq('action', 'REMINDER_OPENED')
        .eq('metadata->>match_id', matchId)
        .order('created_at', { ascending: false }),
    ) ?? []) as { entity_id: string; created_at: string }[]
    const latest: Record<string, string> = {}
    for (const r of rows) latest[r.entity_id] ??= r.created_at
    return latest
  },
}
