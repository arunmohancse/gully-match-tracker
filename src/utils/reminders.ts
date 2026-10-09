import type { AdminRegistration, Match } from '@/types/domain'
import { amountDue } from './cost'

/**
 * Reminders are for unpaid main-list players who owe something, on a live or finished match
 * (not drafts or cancelled matches). For shared-cost matches that means the share has been calculated.
 */
export function canRemind(reg: AdminRegistration, match: Match): boolean {
  const owed = amountDue(match, reg)
  return (
    reg.status === 'ACTIVE' &&
    reg.list_type === 'MAIN_LIST' &&
    reg.payment_status === 'UNPAID' &&
    owed !== null &&
    owed > 0 &&
    (match.status === 'OPEN' || match.status === 'FULL' || match.status === 'CLOSED' || match.status === 'COMPLETED')
  )
}

/** "8 Oct, 10:12 AM" in local time, for the "Reminded ..." hint. */
export function formatReminded(iso: string): string {
  const d = new Date(iso)
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const h = d.getHours()
  return `${d.getDate()} ${months[d.getMonth()]}, ${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
}
