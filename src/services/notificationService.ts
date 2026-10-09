import { WhatsAppClickService } from './notifications/WhatsAppClickService'
import type { NotificationService } from './notifications/types'

export type { NotificationService, ReminderTarget } from './notifications/types'

/**
 * The active notification channel. To move to the WhatsApp Business API, add a
 * `WhatsAppBusinessService` (calling an Edge Function) and return it here.
 */
export const notificationService: NotificationService = new WhatsAppClickService()
