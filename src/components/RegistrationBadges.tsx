import { Badge } from '@/components/ui/badge'
import type { ListType, PaymentStatus } from '@/types/domain'
import { listLabel } from '@/utils/registration'

export function ListBadge({ listType, position }: { listType: ListType; position: number | null }) {
  const style = listType === 'MAIN_LIST' ? 'bg-success-tint text-success' : 'bg-warning-tint text-warning'
  return <Badge className={style}>{listLabel(listType, position)}</Badge>
}

const PAYMENT_STYLE: Record<PaymentStatus, string> = {
  PAID: 'bg-success-tint text-success',
  UNPAID: 'bg-danger-tint text-danger',
  REFUNDED: 'bg-surface-4 text-fg-2',
  WAIVED: 'bg-info-soft text-info',
}

export function PaymentBadge({ status }: { status: PaymentStatus }) {
  return <Badge className={PAYMENT_STYLE[status]}>{status}</Badge>
}

export function CancelledBadge() {
  return <Badge className="bg-surface-4 text-subtle">CANCELLED</Badge>
}
