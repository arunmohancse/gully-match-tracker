import { AppError } from '@/lib/errors'
import type { Match } from '@/types/domain'
import { buildReminderMessage, buildWhatsAppChatUrl } from '@/utils/whatsapp'
import type { NotificationService, ReminderTarget } from './types'

type OpenWindow = (url: string) => { opener: unknown } | null

const defaultOpen: OpenWindow = (url) => window.open(url, '_blank')

/**
 * Click-to-Chat: opens WhatsApp with a prefilled message. The admin must press Send themselves;
 * nothing is sent automatically and there is no way to confirm delivery.
 */
export class WhatsAppClickService implements NotificationService {
  private readonly openWindow: OpenWindow

  constructor(openWindow: OpenWindow = defaultOpen) {
    this.openWindow = openWindow
  }

  // Deliberately has no `await`: window.open must run inside the user's click.
  async sendPaymentReminder(player: ReminderTarget, match: Match): Promise<void> {
    if (!player.phone) throw new AppError('This player has no phone number saved.')
    const url = buildWhatsAppChatUrl(
      player.phone,
      buildReminderMessage(player.name, match, { amount: player.amountDue, instructions: player.paymentInstructions }),
    )
    if (!url) throw new AppError("This player's phone number looks invalid.")

    const opened = this.openWindow(url)
    if (!opened) throw new AppError('Your browser blocked the WhatsApp window. Allow pop-ups for this site and try again.')
    opened.opener = null
  }
}
