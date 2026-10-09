import { Badge } from '@/components/ui/badge'
import type { ListType, PaymentStatus } from '@/types/domain'
import { listLabel } from '@/utils/registration'

export function ListBadge({ listType, position }: { listType: ListType; position: number | null }) {
  const style = listType === 'MAIN_LIST' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-800'
  return <Badge className={style}>{listLabel(listType, position)}</Badge>
}

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  PAID: 'bg-green-100 text-green-800',
  UNPAID: 'bg-red-100 text-red-800',
  REFUNDED: 'bg-slate-200 text-slate-700',
  WAIVED: 'bg-blue-100 text-blue-800',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge className={PAYMENT_STYLE[status]}>{status}</Badge>
}

export function CancelledBadge() {
  return <Badge className="bg-slate-200 text-slate-500">CANCELLED</Badge>
}
