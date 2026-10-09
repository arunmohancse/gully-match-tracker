import { Link } from 'react-router-dom'
import { PaymentBadge } from '@/components/RegistrationBadges'
import { UpiPay } from '@/components/UpiPay'
import { Card } from '@/components/ui/card'
import { useMyRegistrations } from '@/hooks/useRegistrations'
import { formatShortDate } from '@/utils/dates'
import { myDues } from '@/utils/dues'
import { formatINR } from '@/utils/money'

/** What the player still owes across all matches, with a Pay with UPI button for each. Shows nothing when they are all paid up. */
export function MyDuesCard() {
  const { data } = useMyRegistrations()
  const { dues, total } = myDues(data ?? [])
  if (dues.length === 0) return null

  return (
    <Card className="space-y-3 border-orange-300 bg-orange-50">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold text-orange-900">Payments due</h2>
        <span className="text-lg font-bold text-orange-900">{formatINR(total)}</span>
      </div>
      <ul className="divide-y divide-orange-200">
        {dues.map(({ registration: r, amount }) => (
          <li key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <Link to={`/matches/${r.match.id}`} className="font-medium hover:underline">
                  {r.match.title}
                </Link>
                <div className="text-sm text-slate-600">{formatShortDate(r.match.match_date)}</div>
              </div>
              <div className="flex items-center gap-2">
                <PaymentBadge status={r.payment_status} />
                <span className="font-semibold">{formatINR(amount)}</span>
              </div>
            </div>
            <UpiPay communityId={r.match.community_id} amount={amount} note={r.match.title} />
          </li>
        ))}
      </ul>
      <p className="text-xs text-slate-600">After you pay, the organiser marks it as paid and it disappears from this list.</p>
    </Card>
  )
}
