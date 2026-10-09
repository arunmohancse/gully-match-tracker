import { Check } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import type { RosterEntry } from '@/types/domain'

function Section({ title, entries, empty, tone }: { title: string; entries: RosterEntry[]; empty: string; tone: 'green' | 'orange' }) {
  return (
    <section aria-label={title}>
      <h3 className={cn('mb-2 text-sm font-semibold uppercase tracking-wide', tone === 'green' ? 'text-green-700' : 'text-orange-700')}>
        {title} ({entries.length})
      </h3>
      {entries.length === 0 ? (
        <p className="text-sm text-slate-500">{empty}</p>
      ) : (
        <ol className="divide-y divide-slate-100 rounded-md border border-slate-200">
          {entries.map((e) => (
            <li
              key={`${e.list_type}-${e.list_position}`}
              className={cn('flex items-center gap-3 px-3 py-2 text-sm', e.is_me && 'bg-green-50 font-semibold')}
              aria-current={e.is_me ? 'true' : undefined}
            >
              <span className="w-6 text-right text-slate-500">{e.list_position}.</span>
              <span className="flex-1">{e.display_name}</span>
              {e.is_me && (
                <span className="flex items-center gap-1 text-xs text-green-700">
                  <Check className="size-3" aria-hidden /> You
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}

/** Names only: no phone numbers or payment details of other players. */
export function RosterList({ entries }: { entries: RosterEntry[] }) {
  const main = entries.filter((e) => e.list_type === 'MAIN_LIST')
  const waiting = entries.filter((e) => e.list_type === 'WAITING_LIST')
  return (
    <Card className="space-y-5">
      <Section title="Main list" entries={main} empty="No players registered yet." tone="green" />
      {(waiting.length > 0 || main.length > 0) && <Section title="Waiting list" entries={waiting} empty="Nobody is waiting." tone="orange" />}
    </Card>
  )
}
