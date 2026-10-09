import type { RegistrationWithMatch } from '@/types/domain'
import { amountDue } from './cost'

export interface Due {
  registration: RegistrationWithMatch
  amount: number
}

/**
 * What a player still owes: active main-list registrations that are unpaid and have a known amount.
 * Waived, paid, waiting-list, cancelled and "share not calculated yet" registrations are not dues.
 * Oldest match first, so the longest-outstanding comes first.
 */
export function myDues(registrations: RegistrationWithMatch[]): { dues: Due[]; total: number } {
  const dues = registrations
    .filter((r) => r.status === 'ACTIVE' && r.list_type === 'MAIN_LIST' && r.payment_status === 'UNPAID' && r.match.status !== 'CANCELLED' && r.match.status !== 'DRAFT')
    .flatMap((r) => {
      const amount = amountDue(r.match, r)
      return amount !== null && amount > 0 ? [{ registration: r, amount }] : []
    })
    .sort((a, b) => a.registration.match.match_date.localeCompare(b.registration.match.match_date))
  return { dues, total: dues.reduce((sum, d) => sum + d.amount, 0) }
}
