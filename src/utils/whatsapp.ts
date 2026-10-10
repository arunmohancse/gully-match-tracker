import type { Match } from '@/types/domain'
import { isShared } from './cost'
import { formatMatchDate, formatTime } from './dates'
import { formatINR } from './money'

/** wa.me link that lets the user pick a chat or group and send the prefilled text. */
export function buildWhatsAppShareUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`
}

/** wa.me link that opens a chat with a specific number. Returns null if the number is unusable. */
export function buildWhatsAppChatUrl(phone: string, text: string): string | null {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7 || digits.length > 15) return null
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
}

/** Prefilled for the admin who is vetting a signup: sent only if the person turns out not to be in the community group. Plain text only. */
export function buildNotMemberMessage(fullName: string, communityName: string): string {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there'
  return `Hi ${firstName}, thanks for signing up. You need to be a member of the ${communityName} WhatsApp community to use this app, so we could not approve your account. Please contact an organiser to join the group and then sign up again.`
}

export interface ReminderOptions {
  /** What this player owes. Defaults to the match fee. */
  amount?: number | null
  /** Where / how to pay (for example a UPI id). */
  instructions?: string | null
}

/** Plain text only (no emojis): WhatsApp Desktop on Windows can garble them in links. */
export function buildReminderMessage(fullName: string, match: Match, options: ReminderOptions = {}): string {
  const firstName = fullName.trim().split(/\s+/)[0] || 'there'
  const time = match.end_time ? `${formatTime(match.start_time)} - ${formatTime(match.end_time)}` : formatTime(match.start_time)
  const amount = options.amount ?? match.registration_fee
  const shared = isShared(match)
  const done = match.status === 'COMPLETED'
  const instructions = options.instructions?.trim()

  const headline = shared
    ? `Payment reminder for the match: ${match.title}.`
    : done
      ? `Payment is still pending for the match: ${match.title}.`
      : `Reminder for the upcoming match: ${match.title}.`
  const amountLine = shared
    ? `Your share of the match expenses: ${formatINR(amount)}`
    : done
      ? `Amount due: ${formatINR(amount)}`
      : `Registration fee: ${formatINR(amount)}`
  const ask = done || shared ? 'Please complete the payment at your earliest convenience.' : 'Please complete the payment before the match.'

  return [
    `Hi ${firstName},`,
    '',
    headline,
    '',
    `Date: ${formatMatchDate(match.match_date)}`,
    `Time: ${time}`,
    `Venue: ${match.venue}`,
    '',
    amountLine,
    '',
    ask,
    ...(instructions ? ['', 'Payment details:', instructions] : []),
    '',
    'If you have already paid, please let the admin know so we can update the payment status.',
    '',
    'Thank you!',
  ].join('\n')
}
