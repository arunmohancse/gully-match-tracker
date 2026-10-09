import type { AdminRegistration, Match, MatchFinancials } from '@/types/domain'
import { amountDue, hasPayments, isShared } from './cost'
import { formatMatchDate } from './dates'
import { formatINR } from './money'

/** What each player pays for this match, or null when it is not known yet (shared cost whose shares are not calculated). */
export function amountPerPlayer(match: Pick<Match, 'cost_model' | 'registration_fee'>, f: Pick<MatchFinancials, 'shares_calculated' | 'share_amount'> | undefined): number | null {
  if (!hasPayments(match)) return null
  if (isShared(match)) return f?.shares_calculated && f.share_amount != null ? f.share_amount : null
  return match.registration_fee
}

const header = (match: Match, label: string) => [`*${match.title.toUpperCase()} - ${label}*`, `${formatMatchDate(match.match_date)}, ${match.venue}`, '']

const payTo = (instructions: string | null | undefined) => {
  const text = instructions?.trim()
  return text ? ['Please pay to:', text, ''] : []
}

/** The general "here is your share, please pay" post for the WhatsApp group, sent right after the match. No names. */
export function buildPaymentRequest(match: Match, amount: number, players: number, instructions: string | null | undefined): string {
  return [
    ...header(match, 'PAYMENT'),
    'Thank you all for playing!',
    '',
    `${isShared(match) ? 'Share per player' : 'Match fee per player'}: ${formatINR(amount)}${players > 0 ? ` (${players} players)` : ''}`,
    '',
    ...payTo(instructions),
    'Please make the payment and share the screenshot with the admin.',
  ].join('\n')
}

/** Main-list players who still owe money (unpaid, with a known amount). Waived and paid players are not included. */
export function pendingPlayers(match: Match, regs: AdminRegistration[]): { name: string; amount: number }[] {
  return regs
    .filter((r) => r.status === 'ACTIVE' && r.list_type === 'MAIN_LIST' && r.payment_status === 'UNPAID')
    .sort((a, b) => (a.list_position ?? 0) - (b.list_position ?? 0))
    .flatMap((r) => {
      const amount = amountDue(match, r)
      return amount === null ? [] : [{ name: r.player?.full_name?.trim() || 'Unknown player', amount }]
    })
}

/** The follow-up post a day or so later: who is still pending. Meant for the group, so the tone stays friendly. */
export function buildPendingList(match: Match, pending: { name: string; amount: number }[], instructions: string | null | undefined): string {
  const sameAmount = pending.length > 0 && pending.every((p) => p.amount === pending[0].amount)
  return [
    ...header(match, 'PENDING PAYMENTS'),
    'Thank you to everyone who has paid. A gentle reminder to the players below:',
    '',
    ...pending.map((p, i) => `${i + 1}. ${p.name}${sameAmount ? '' : ` - ${formatINR(p.amount)}`}`),
    '',
    ...(sameAmount ? [`Amount: ${formatINR(pending[0].amount)} each`, ''] : []),
    ...payTo(instructions),
    'Please pay at your earliest convenience and share the screenshot with the admin.',
  ].join('\n')
}
