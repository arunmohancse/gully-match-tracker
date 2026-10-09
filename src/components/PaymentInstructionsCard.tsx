import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { usePaymentInstructions, useSavePaymentInstructions } from '@/hooks/useCommunity'
import { toFriendlyMessage } from '@/lib/errors'

/** Admin: where players should send money (for example a UPI id). Shown to players and added to reminders. */
export function PaymentInstructionsCard({ communityId }: { communityId: string }) {
  const { data, isLoading } = usePaymentInstructions(communityId)
  const save = useSavePaymentInstructions(communityId)
  const [draft, setDraft] = useState<string | null>(null)
  const [message, setMessage] = useState<{ type: 'ok' | 'error'; text: string } | null>(null)

  if (isLoading) return null
  const value = draft ?? data ?? ''

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (save.isPending) return
    setMessage(null)
    try {
      await save.mutateAsync(value)
      setDraft(null)
      setMessage({ type: 'ok', text: 'Saved.' })
    } catch (err) {
      setMessage({ type: 'error', text: toFriendlyMessage(err) })
    }
  }

  return (
    <Card className="p-0">
      <details>
        <summary className="cursor-pointer px-4 py-3 text-sm font-semibold">Payment instructions {data ? '' : '(not set)'}</summary>
        <form onSubmit={onSubmit} className="space-y-3 px-4 pb-4">
          <p className="text-sm text-slate-600">Shown to players on their payment card and added to the end of WhatsApp reminders.</p>
          <label htmlFor="payment-instructions" className="sr-only">
            Payment instructions
          </label>
          <Textarea id="payment-instructions" value={value} onChange={(e) => setDraft(e.target.value)} placeholder="Pay by UPI to club@upi (Arun)" />
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
