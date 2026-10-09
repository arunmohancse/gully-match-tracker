import { Check, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useReminderSender } from '@/hooks/useReminderSender'
import type { AdminRegistration, Match } from '@/types/domain'

/**
 * Bulk reminders with Click-to-Chat. Browsers only allow one new window per click and WhatsApp needs
 * the sender to press Send, so each chat is opened one at a time by the admin.
 */
export function ReminderQueue({ regs, match, onClose }: { regs: AdminRegistration[]; match: Match; onClose: () => void }) {
  const { send, error } = useReminderSender(match)
  const [opened, setOpened] = useState<Set<string>>(new Set())

  const next = regs.find((r) => !opened.has(r.id))

  async function open(reg: AdminRegistration) {
    if (await send(reg)) setOpened((prev) => new Set(prev).add(reg.id))
  }

  return (
    <Card className="space-y-3 border-green-300">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">WhatsApp reminders ({opened.size} of {regs.length} opened)</h2>
          <p className="text-sm text-slate-600">
            WhatsApp links cannot send messages automatically. Open each chat below, check the message, and press <strong>Send</strong> in WhatsApp yourself. Then come
            back here for the next one.
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          Done
        </Button>
      </div>

      {next ? (
        <Button size="lg" className="w-full" onClick={() => void open(next)}>
          <MessageCircle className="size-4" aria-hidden /> Open next chat: {next.player?.full_name ?? 'player'}
        </Button>
      ) : (
        <p role="status" className="rounded-md bg-green-50 p-2 text-sm text-green-800">
          All chats opened. Make sure you pressed Send in each WhatsApp window.
        </p>
      )}

      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}

      <ul className="divide-y divide-slate-100 rounded-md border border-slate-200">
        {regs.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
            <span className="flex items-center gap-2">
              {opened.has(r.id) && <Check className="size-4 text-green-700" aria-label="Opened" />}
              {r.player?.full_name ?? 'Unknown player'}
            </span>
            <Button size="sm" variant="outline" onClick={() => void open(r)}>
              {opened.has(r.id) ? 'Open again' : 'Open chat'}
            </Button>
          </li>
        ))}
      </ul>
    </Card>
  )
}
