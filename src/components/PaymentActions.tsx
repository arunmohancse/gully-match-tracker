import { useState } from 'react'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useSetPayment } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import type { AdminRegistration, Match, PaymentStatus } from '@/types/domain'
import { formatINR, PAYMENT_METHODS, parseMoney } from '@/utils/money'

type Dialog = 'paid' | 'unpaid' | 'waive' | 'refund'

const nameOf = (r: AdminRegistration) => r.player?.full_name ?? 'this player'

/** Payment buttons + confirmation dialogs for one registration. Authorization is enforced by the database. */
export function PaymentActions({ reg, match }: { reg: AdminRegistration; match: Match }) {
  const setPayment = useSetPayment()
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [amount, setAmount] = useState('')
  const [method, setMethod] = useState<string>(PAYMENT_METHODS[0])
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)

  const status: PaymentStatus = reg.payment_status
  const active = reg.status === 'ACTIVE'

  function open(d: Dialog) {
    setError(null)
    setAmount(String(reg.amount_due ?? match.registration_fee))
    setMethod(PAYMENT_METHODS[0])
    setReference('')
    setDialog(d)
  }

  async function confirm() {
    if (!dialog || setPayment.isPending) return
    setError(null)
    let input: Parameters<typeof setPayment.mutateAsync>[0]
    if (dialog === 'paid') {
      const parsed = parseMoney(amount)
      if (parsed === null) return setError('Enter a valid amount, for example 150 or 150.50.')
      input = { registrationId: reg.id, status: 'PAID', amount: parsed, method, reference: reference.trim() || null }
    } else {
      const next: PaymentStatus = dialog === 'unpaid' ? 'UNPAID' : dialog === 'waive' ? 'WAIVED' : 'REFUNDED'
      input = { registrationId: reg.id, status: next }
    }
    try {
      await setPayment.mutateAsync(input)
      setDialog(null)
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  const copy: Record<Dialog, { title: string; body: string; label: string; busy: string; destructive?: boolean }> = {
    paid: { title: `Mark ${nameOf(reg)} as paid`, body: 'Record how much was received.', label: 'Mark as paid', busy: 'Marking payment...' },
    unpaid: {
      title: 'Mark this payment as unpaid?',
      body: `The recorded amount, method and reference for ${nameOf(reg)} will be cleared.`,
      label: 'Mark as unpaid',
      busy: 'Marking payment...',
      destructive: true,
    },
    waive: { title: `Waive ${nameOf(reg)}'s fee?`, body: 'They will not be counted as owing anything for this match.', label: 'Waive fee', busy: 'Updating...' },
    refund: {
      title: 'Mark this payment as refunded?',
      body: `Confirm you have returned ${reg.payment_amount != null ? formatINR(reg.payment_amount) : 'the money'} to ${nameOf(reg)}.`,
      label: 'Mark as refunded',
      busy: 'Updating...',
    },
  }

  const buttons: { d: Dialog; label: string; variant?: 'default' | 'outline' }[] = []
  if (active) {
    if (status === 'UNPAID' || status === 'REFUNDED') buttons.push({ d: 'paid', label: 'Mark paid', variant: 'default' }, ...(status === 'UNPAID' ? [{ d: 'waive' as const, label: 'Waive', variant: 'outline' as const }] : []))
    else buttons.push({ d: 'unpaid', label: 'Mark unpaid', variant: 'outline' })
  } else if (status === 'PAID') {
    buttons.push({ d: 'refund', label: 'Mark refunded', variant: 'default' })
  }

  return (
    <>
      {buttons.map((b) => (
        <Button key={b.d} size="sm" variant={b.variant ?? 'outline'} onClick={() => open(b.d)}>
          {b.label}
        </Button>
      ))}
      {dialog && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && setDialog(null)}
          title={copy[dialog].title}
          description={copy[dialog].body}
          confirmLabel={copy[dialog].label}
          loadingLabel={copy[dialog].busy}
          destructive={copy[dialog].destructive}
          loading={setPayment.isPending}
          error={error}
          onConfirm={confirm}
        >
          {dialog === 'paid' && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label htmlFor="pay-amount" className="text-sm font-medium">
                  Amount received (₹)
                </label>
                <Input id="pay-amount" inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pay-method" className="text-sm font-medium">
                  Method
                </label>
                <select id="pay-method" value={method} onChange={(e) => setMethod(e.target.value)} className="h-11 w-full rounded-md border border-slate-300 bg-white px-3">
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label htmlFor="pay-ref" className="text-sm font-medium">
                  Reference (optional)
                </label>
                <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="UPI transaction id" />
              </div>
            </div>
          )}
        </ConfirmDialog>
      )}
    </>
  )
}
