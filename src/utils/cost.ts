import type { Match, MatchFinancials, Registration } from '@/types/domain'
import { formatINR } from './money'

export const SHARE_STEPS = [1, 5, 10] as const
export type ShareStep = (typeof SHARE_STEPS)[number]

/** Shared-cost: no fee up front; the expenses are split equally among main-list players after the match. */
export function isShared(match: Pick<Match, 'cost_model'>): boolean {
  return match.cost_model === 'SHARED_COST'
}

/** What a player owes for this match, or null when it is not known yet (shared cost, shares not calculated). */
export function amountDue(match: Pick<Match, 'cost_model' | 'registration_fee'>, reg: Pick<Registration, 'amount_due'>): number | null {
  if (isShared(match)) return reg.amount_due
  return match.registration_fee > 0 ? match.registration_fee : null
}

/** Whether money changes hands for this match at all (a fixed fee, or shared costs). */
export function hasPayments(match: Pick<Match, 'cost_model' | 'registration_fee'>): boolean {
  return isShared(match) || match.registration_fee > 0
}

/** Short cost description for cards and announcements; null when there is nothing to show (free fixed-fee match). */
export function costLabel(match: Pick<Match, 'cost_model' | 'registration_fee'>): string | null {
  if (isShared(match)) return 'Shared equally among players after the match'
  return match.registration_fee > 0 ? formatINR(match.registration_fee) : null
}

export interface SharePreview {
  exact: number
  share: number
  /** What the share collects in total, minus the real expenses. */
  surplus: number
}

/**
 * Mirrors the database: total / participants, rounded UP to a multiple of `step` rupees.
 * Works in whole paise so floating point cannot push 150.00 up to 151.
 */
export function computeShare(totalExpenses: number, participants: number, step: number = 1): SharePreview | null {
  if (!(participants > 0) || !(totalExpenses > 0) || !(step > 0)) return null
  const totalPaise = Math.round(totalExpenses * 100)
  const stepPaise = Math.round(step * 100)
  const sharePaise = Math.ceil(totalPaise / participants / stepPaise - 1e-9) * stepPaise
  return {
    exact: totalPaise / participants / 100,
    share: sharePaise / 100,
    surplus: (sharePaise * participants - totalPaise) / 100,
  }
}

/** Can the admin record payments for this registration yet? (Shared cost needs the share calculated first.) */
export function canTrackPayment(match: Pick<Match, 'cost_model' | 'registration_fee'>, reg: Pick<Registration, 'amount_due' | 'payment_status'>): boolean {
  if (isShared(match)) return reg.amount_due != null || reg.payment_status !== 'UNPAID'
  return match.registration_fee > 0
}

/** For match cards: should the paid / unpaid line be shown? */
export function showPaymentLine(match: Pick<Match, 'cost_model' | 'registration_fee'>, f: MatchFinancials | undefined): boolean {
  if (!f) return false
  return isShared(match) ? f.shares_calculated : match.registration_fee > 0
}

/** Amount shown next to a payment badge: what was paid, else what is owed, else why it is unknown. */
export function amountText(
  match: Pick<Match, 'cost_model' | 'registration_fee'>,
  reg: Pick<Registration, 'amount_due' | 'payment_status' | 'payment_amount'>,
): string {
  const due = amountDue(match, reg)
  if (reg.payment_status === 'PAID' && reg.payment_amount != null) {
    const paid = formatINR(reg.payment_amount)
    return due !== null && due !== reg.payment_amount ? `${paid} (now owes ${formatINR(due)})` : paid
  }
  return due !== null ? formatINR(due) : 'Share not calculated'
}
