import { CalendarDays, Clock, MapPin, Navigation, Users, Wallet } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { MatchStatusBadge } from '@/components/MatchStatusBadge'
import { matchService } from '@/services/matchService'
import type { Match } from '@/types/domain'
import { formatMatchDate, formatTime } from '@/utils/dates'
import { isShared } from '@/utils/cost'
import { formatINR } from '@/utils/money'

function Row({ icon: Icon, label, children }: { icon: typeof Clock; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <div>
        <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
        <div className="font-medium">{children}</div>
      </div>
    </div>
  )
}

/** Announcement-style match information, shared by player, public and admin pages. */
export function MatchDetails({ match }: { match: Match }) {
  const imageUrl = matchService.imageUrl(match.image_path)
  const time = match.end_time ? `${formatTime(match.start_time)} - ${formatTime(match.end_time)}` : formatTime(match.start_time)

  return (
    <Card className="space-y-4 overflow-hidden p-0">
      {imageUrl && <img src={imageUrl} alt={`${match.title} announcement`} className="max-h-72 w-full object-cover" />}
      <div className="space-y-4 p-4">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-2xl font-bold">{match.title}</h1>
          <MatchStatusBadge status={match.status} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <Row icon={CalendarDays} label="Date">{formatMatchDate(match.match_date)}</Row>
          <Row icon={Clock} label="Time">{time}</Row>
          <Row icon={MapPin} label="Venue">
            {match.venue}
            {match.map_url && (
              <a
                href={match.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 flex w-fit items-center gap-1 text-sm font-medium text-brand underline"
              >
                <Navigation className="size-4" aria-hidden /> Open in Google Maps
              </a>
            )}
          </Row>
          {isShared(match) ? (
            <Row icon={Wallet} label="Cost">
              Shared equally after the match
            </Row>
          ) : (
            match.registration_fee > 0 && (
              <Row icon={Wallet} label="Match fee">
                {formatINR(match.registration_fee)}
              </Row>
            )
          )}
          <Row icon={Users} label="Maximum players">{match.max_players}</Row>
        </div>

        {match.description && <p className="whitespace-pre-line text-slate-700">{match.description}</p>}

        {match.rules && (
          <section>
            <h2 className="mb-1 font-semibold">Rules &amp; instructions</h2>
            <p className="whitespace-pre-line text-sm text-slate-700">{match.rules}</p>
          </section>
        )}
      </div>
    </Card>
  )
}
