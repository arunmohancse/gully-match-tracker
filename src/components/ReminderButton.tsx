import { MessageCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useReminderSender } from '@/hooks/useReminderSender'
import type { AdminRegistration, Match } from '@/types/domain'
import { canRemind, formatReminded } from '@/utils/reminders'

/** "Send WhatsApp Reminder" for one unpaid main-list player. Opens WhatsApp; the admin presses Send there. */
export function ReminderButton({ reg, match, lastAt }: { reg: AdminRegistration; match: Match; lastAt?: string }) {
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
      {lastAt && <span className="text-xs text-slate-500">Reminded {formatReminded(lastAt)}</span>}
      {error && (
        <span role="alert" className="max-w-56 text-xs text-red-600">
          {error}
        </span>
      )}
    </div>
  )
}
