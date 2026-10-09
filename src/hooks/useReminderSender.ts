import { useState } from 'react'
import { usePaymentInstructions } from '@/hooks/useCommunity'
import { useLogReminder } from '@/hooks/useReminders'
import { toFriendlyMessage } from '@/lib/errors'
import { notificationService } from '@/services/notificationService'
import type { AdminRegistration, Match } from '@/types/domain'
import { amountDue } from '@/utils/cost'

/**
 * Opens a WhatsApp reminder chat and records it. Call `send` directly from a click handler:
 * the chat window is opened synchronously, which keeps browsers from blocking it.
 * The message carries the player's amount (their share, or the fixed fee) and the payment instructions.
 */
export function useReminderSender(match: Match) {
  const log = useLogReminder()
  const { data: instructions } = usePaymentInstructions(match.community_id)
  const [error, setError] = useState<string | null>(null)

  async function send(reg: AdminRegistration): Promise<boolean> {
    setError(null)
    try {
      await notificationService.sendPaymentReminder(
        {
          name: reg.player?.full_name ?? '',
          phone: reg.player?.phone ?? null,
          amountDue: amountDue(match, reg),
          paymentInstructions: instructions || null,
        },
        match,
      )
    } catch (e) {
      setError(toFriendlyMessage(e))
      return false
    }
    log.mutate(reg.id, { onError: () => setError('Chat opened, but the reminder could not be recorded.') })
    return true
  }

  return { send, error, clearError: () => setError(null), recording: log.isPending }
}
