import { ChevronLeft, Clock, MapPin, Navigation, Pencil, Users, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SlotsBar } from '@/components/MatchBits'
import { Card } from '@/components/ui/card'
import { matchService } from '@/services/matchService'
import type { Match, MatchCounts } from '@/types/domain'
import { formatMatchDate, formatTime, formatWeekday } from '@/utils/dates'
import { isShared } from '@/utils/cost'
import { matchStatusLabel } from '@/utils/matchStatus'
import { formatINR } from '@/utils/money'

function Row({ icon: Icon, label, children, aside }: { icon: typeof Clock; label: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
        <Icon className="size-5" aria-hidden />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-xs font-bold text-subtle">{label}</div>
        <div className="font-bold">{children}</div>
      </div>
      {aside}
    </div>
  )
}

const pitchButton =
  'inline-flex h-10 items-center gap-1.5 rounded-full bg-black/25 px-3.5 text-sm font-bold text-white hover:bg-black/35 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white'

/** Announcement-style match information, shared by player, public and admin pages. */
export function MatchDetails({ match, editTo, backTo, counts }: { match: Match; editTo?: string; backTo?: string; counts?: MatchCounts }) {
  const imageUrl = matchService.imageUrl(match.image_path)
  const time = match.end_time ? `${formatTime(match.start_time)} – ${formatTime(match.end_time)}` : formatTime(match.start_time)

  return (
    <div className="space-y-3">
      <section className="space-y-4 rounded-2xl bg-pitch p-4 text-on-pitch sm:p-5">
        {(backTo || editTo) && (
          <div className="flex items-center justify-between gap-2">
            {backTo ? (
              <Link to={backTo} className={`${pitchButton} pl-2`}>
                <ChevronLeft className="size-5" aria-hidden /> Matches
              </Link>
            ) : (
              <span />
            )}
            {editTo && (
              <Link to={editTo} className={pitchButton}>
                <Pencil className="size-4" aria-hidden /> Edit
              </Link>
            )}
          </div>
        )}
        <div className="space-y-2">
          <span className="inline-block rounded-full bg-black/25 px-2.5 py-1 text-xs font-bold text-white">{matchStatusLabel(match)}</span>
          <h1 className="font-display text-4xl font-bold leading-none">{match.title}</h1>
        </div>
        {counts && <SlotsBar registered={counts.main_count} max={match.max_players} waiting={counts.waiting_count} onPitch />}
      </section>

      <Card className="overflow-hidden p-0">
        {imageUrl && <img src={imageUrl} alt={`${match.title} announcement`} className="max-h-72 w-full object-cover" />}
        <div className="divide-y divide-line px-4">
          <Row icon={Clock} label="When">
            {formatWeekday(match.match_date)}, {formatMatchDate(match.match_date)} · {time}
          </Row>
          <Row
            icon={MapPin}
            label="Venue"
            aside={
              match.map_url && (
                <a
                  href={match.map_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in Google Maps"
                  title="Open in Google Maps"
                  className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-line text-brand hover:bg-surface-3 focus-visible:outline-2 focus-visible:outline-brand"
                >
                  <Navigation className="size-5" aria-hidden />
                </a>
              )
            }
          >
            {match.venue}
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
          <Row icon={Users} label="Maximum players">
            {match.max_players}
          </Row>
          {match.description && <p className="whitespace-pre-line py-3 text-fg-2">{match.description}</p>}
          {match.rules && (
            <section className="py-3">
              <h2 className="mb-1 font-extrabold">Rules &amp; instructions</h2>
              <p className="whitespace-pre-line text-sm text-fg-2">{match.rules}</p>
            </section>
          )}
        </div>
      </Card>
    </div>
  )
}
