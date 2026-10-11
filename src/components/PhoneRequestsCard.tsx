import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useDecidePhoneChange, usePhoneRequests } from '@/hooks/usePayments'
import { toFriendlyMessage } from '@/lib/errors'
import { buildWhatsAppChatUrl } from '@/utils/whatsapp'

/** Open requests from players who want a different phone number. Renders nothing when there are none. */
export function PhoneRequestsCard() {
  const { data } = usePhoneRequests()
  const decide = useDecidePhoneChange()
  const [error, setError] = useState<string | null>(null)
  if (!data?.length) return null

  async function run(requestId: string, approve: boolean) {
    setError(null)
    try {
      await decide.mutateAsync({ requestId, approve })
    } catch (e) {
      setError(toFriendlyMessage(e))
    }
  }

  return (
    <Card className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold">Phone number change requests ({data.length})</h2>
        <p className="text-sm text-slate-600">Message the new number on WhatsApp to confirm it is really them, then approve.</p>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
      <ul className="divide-y divide-slate-100">
        {data.map((r) => {
          const chat = buildWhatsAppChatUrl(r.new_phone)
          return (
            <li key={r.id} className="space-y-2 py-3 first:pt-0 last:pb-0">
              <div>
                <div className="font-medium">{r.full_name}</div>
                <div className="text-sm text-slate-600">
                  {r.current_phone ?? 'No phone'} → <span className="font-medium text-slate-900">{r.new_phone}</span>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={decide.isPending} onClick={() => run(r.id, true)}>
                  Approve
                </Button>
                <Button size="sm" variant="outline" disabled={decide.isPending} onClick={() => run(r.id, false)}>
                  Reject
                </Button>
                {chat && (
                  <Button size="sm" variant="outline" asChild>
                    <a href={chat} target="_blank" rel="noreferrer" aria-label={`Check the new number of ${r.full_name} on WhatsApp`}>
                      <MessageCircle className="size-4" aria-hidden /> Check new number
                    </a>
                  </Button>
                )}
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}
