import type { Match } from '@/types/domain'

export interface ReminderTarget {
  name: string
  phone: string | null
  /** What this player owes (their share, or the fixed fee). Falls back to the match fee. */
  amountDue?: number | null
  /** Where/how to pay, for example a UPI id. Appended to the message when present. */
  paymentInstructions?: string | null
}

/**
 * Delivery channel for player notifications. Core registration/payment logic only depends on this
 * interface, so a WhatsApp Business API provider can replace the Click-to-Chat one later.
 *
 * Implementations that need the user's click (like Click-to-Chat) must do their browser work
 * synchronously, before any `await`, or browsers will block the popup.
 */
export interface NotificationService {
  sendPaymentReminder(player: ReminderTarget, match: Match): Promise<void>
}
