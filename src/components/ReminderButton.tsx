import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReminderSender } from '@/hooks/useReminderSender'
import type { AdminRegistration, Match } from '@/types/domain'
import { canRemind, formatReminded } from '@/utils/reminders'

/** "Send WhatsApp Reminder" for one unpaid main-list player. Opens WhatsApp; the admin presses Send there. */
export function ReminderButton({ reg, match }: { reg: AdminRegistration; match: Match }) {
  const { send, error, recording } = useReminderSender(match)
  if (!canRemind(reg, match)) return null

  if (!reg.player?.phone) {
    return <span className="text-xs text-slate-500">No phone number</span>
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button size="sm" variant="outline" onClick={() => void send(reg)} loading={recording} aria-label={`Send WhatsApp reminder to ${reg.player.full_name}`}>
        <MessageCircle className="size-4" aria-hidden /> {recording ? 'Opening...' : 'Remind'}
      </Button>
      {error && (
        <span role="alert" className="max-w-56 text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}

/** "Reminded 9 Oct, 12:57 PM". Shown with the player's details (not under the button), so the buttons keep a fixed width and rows stay aligned. */
export function ReminderStamp({ reg, match, lastAt }: { reg: AdminRegistration; match: Match; lastAt?: string }) {
  if (!lastAt || !canRemind(reg, match)) return null
  return <span className="text-slate-500">· Reminded {formatReminded(lastAt)}</span>
}
