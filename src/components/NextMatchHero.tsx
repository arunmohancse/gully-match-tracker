import { Clock, MapPin, Share2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { SlotsBar } from '@/components/MatchBits'
import { useMatches } from '@/hooks/useMatches'
import { useMatchCounts } from '@/hooks/useRegistrations'
import { matchShareUrl } from '@/lib/config'
import { buildAnnouncement } from '@/utils/announcement'
import { formatTime, relativeDayLabel, todayISO } from '@/utils/dates'
import { matchStatusLabel } from '@/utils/matchStatus'
import { buildWhatsAppShareUrl } from '@/utils/whatsapp'

/** The soonest upcoming match on the striped pitch background, with its main action and a WhatsApp share. Nothing when there is none. */
export function NextMatchHero({ basePath, actionLabel }: { basePath: string; actionLabel: string }) {
  const { data } = useMatches('upcoming')
  const match = (data ?? []).find((m) => m.status !== 'CANCELLED')
  const { data: counts } = useMatchCounts(match ? [match.id] : [])
  if (!match) return null

  const c = counts?.find((x) => x.match_id === match.id)
  const time = match.end_time ? `${formatTime(match.start_time)} – ${formatTime(match.end_time)}` : formatTime(match.start_time)
  const share = buildWhatsAppShareUrl(buildAnnouncement(match, matchShareUrl(match.id)))

  return (
    <section aria-labelledby="next-match" className="space-y-4 rounded-2xl bg-pitch p-4 text-on-pitch sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-on-pitch-muted">Next match · {relativeDayLabel(match.match_date, todayISO())}</span>
        <span className="rounded-full bg-black/25 px-2.5 py-1 text-xs font-bold text-white">{matchStatusLabel(match)}</span>
      </div>
      <div className="space-y-1.5">
        <h2 id="next-match" className="font-display text-3xl font-bold leading-none">
          {match.title}
        </h2>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm font-semibold text-on-pitch-muted">
          <span className="flex items-center gap-1.5">
            <Clock className="size-4" aria-hidden /> {time}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden /> {match.venue}
          </span>
        </p>
      </div>
      {c && <SlotsBar registered={c.main_count} max={match.max_players} waiting={c.waiting_count} onPitch />}
      <div className="flex gap-2">
        <Link
          to={`${basePath}/${match.id}`}
          className="inline-flex h-11 flex-1 items-center justify-center rounded-xl bg-pitch-button text-sm font-extrabold text-pitch-button-fg hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {actionLabel}
        </Link>
        <a
          href={share}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Share on WhatsApp"
          className="inline-flex size-11 items-center justify-center rounded-xl border border-white/35 text-white hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          <Share2 className="size-5" aria-hidden />
        </a>
      </div>
    </section>
  )
}
