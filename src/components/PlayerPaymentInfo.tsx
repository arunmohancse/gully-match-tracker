import { PaymentBadge } from '@/components/RegistrationBadges'
import { UpiPay } from '@/components/UpiPay'
import { usePaymentInstructions } from '@/hooks/useCommunity'
import type { Match, Registration } from '@/types/domain'
import { amountDue, hasPayments, isShared } from '@/utils/cost'
import { formatINR } from '@/utils/money'

type Props = {
  match: Match
  reg: Registration
  /** Full card (with how-to-pay text) or the compact one-line version for lists. */
  variant?: 'full' | 'compact'
}

/** What the player owes for a match and whether it is paid. Main-list players only. */
export function PlayerPaymentInfo({ match, reg, variant = 'full' }: Props) {
  const full = variant === 'full'
  const { data: instructions } = usePaymentInstructions(full ? match.community_id : undefined)

  if (reg.status !== 'ACTIVE' || reg.list_type !== 'MAIN_LIST' || !hasPayments(match)) return null

  const owed = amountDue(match, reg)
  const unpaid = reg.payment_status === 'UNPAID'

  // Shared cost, expenses not divided yet.
  if (isShared(match) && owed === null && unpaid) {
    return (
      <p className="text-sm text-slate-600">
        {full ? 'The cost is shared equally after the match. Your share will appear here once the organiser has calculated it.' : 'Cost shared after the match'}
      </p>
    )
  }

  const amount = reg.payment_status === 'PAID' && reg.payment_amount != null ? reg.payment_amount : owed
  const label = isShared(match) ? 'Your share' : 'Payment'

  return (
    <div className="space-y-1">
      <div className={full ? 'text-sm text-slate-600' : 'sr-only'}>{label}</div>
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {!full && <span className="text-slate-600">{label}:</span>}
        <PaymentBadge status={reg.payment_status} />
        {amount != null && <span className="font-semibold">{formatINR(amount)}</span>}
      </div>
      {full && unpaid && (
        <p className="whitespace-pre-line text-xs text-slate-600">
          {instructions ? `How to pay:\n${instructions}` : 'Pay the organiser. They will mark it as paid.'}
        </p>
      )}
      {full && unpaid && owed !== null && <UpiPay communityId={match.community_id} amount={owed} note={match.title} />}
    </div>
  )
}
