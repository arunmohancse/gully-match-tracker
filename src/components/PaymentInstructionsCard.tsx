import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Field } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { usePaymentSettings, useSavePaymentSettings } from '@/hooks/useCommunity'
import { toFriendlyMessage } from '@/lib/errors'
import type { PaymentSettings } from '@/services/communityService'
import { isValidUpiId } from '@/utils/upi'

const EMPTY: PaymentSettings = { instructions: '', upiId: '', payeeName: '' }

/** Admin: where players should send money. Set once for the whole community. Feeds player payment cards, reminders, WhatsApp posts and UPI QR codes. */
export function PaymentInstructionsCard({ communityId }: { communityId: string }) {
  const { data, isLoading } = usePaymentSettings(communityId)
  const save = useSavePaymentSettings(communityId)
  const [draft, setDraft] = useState<PaymentSettings | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)
  const [upiError, setUpiError] = useState<string | undefined>()

  if (isLoading) return null
  const value = draft ?? data ?? EMPTY
  const edit = (patch: Partial<PaymentSettings>) => setDraft({ ...value, ...patch })

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (save.isPending) return
    setMessage(null)
    if (value.upiId.trim() && !isValidUpiId(value.upiId)) {
      setUpiError('Enter a UPI id like name@bank.')
      return
    }
    setUpiError(undefined)
    try {
      await save.mutateAsync(value)
      setDraft(null)
      setMessage({ type: 'ok', text: 'Saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: toFriendlyMessage(err) })
    }
  }

  const configured = !!(data?.upiId || data?.instructions)

  return (
    <Card className="p-0">
      <details>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Payment settings {configured ? '' : '(not set)'}</summary>
        <form onSubmit={onSubmit} className="space-y-3 px-4 pb-4" noValidate>
          <p className="text-sm text-slate-600">
            Set once for all matches. With a UPI id, players get a Pay with UPI button and a QR code with their exact amount already filled in.
          </p>
          <Field label="UPI ID" htmlFor="upi-id" error={upiError}>
            <Input id="upi-id" value={value.upiId} onChange={(e) => edit({ upiId: e.target.value })} placeholder="arun@okhdfcbank" autoCapitalize="none" autoCorrect="off" />
          </Field>
          <Field label="Payee name (shown in the payer's UPI app)" htmlFor="upi-name">
            <Input id="upi-name" value={value.payeeName} onChange={(e) => edit({ payeeName: e.target.value })} placeholder="Arun Mohan" maxLength={60} />
          </Field>
          <Field label="Other payment instructions (optional)" htmlFor="payment-instructions">
            <Textarea id="payment-instructions" value={value.instructions} onChange={(e) => edit({ instructions: e.target.value })} placeholder="Pay within 2 days of the match" />
          </Field>
          {message && (
            <p role={message.type === 'error' ? 'alert' : 'status'} className={message.type === 'error' ? 'text-sm text-red-600' : 'text-sm text-green-700'}>
              {message.text}
            </p>
          )}
          <Button type="submit" loading={save.isPending}>
            {save.isPending ? 'Saving...' : 'Save'}
          </Button>
        </form>
      </details>
    </Card>
  )
}
