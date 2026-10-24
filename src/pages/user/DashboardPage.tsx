import { Link } from 'react-router-dom'
import { MyDuesCard } from '@/components/MyDuesCard'
import { MatchList } from '@/components/MatchList'
import { NextMatchHero } from '@/components/NextMatchHero'
import { PageHeader } from '@/components/PageHeader'
import { RegistrationItem } from '@/components/RegistrationItem'
import { useAuth } from '@/hooks/useAuth'
import { useMatches } from '@/hooks/useMatches'
import { useMyRegistrations } from '@/hooks/useRegistrations'
import { formatShortDate, formatWeekday, todayISO } from '@/utils/dates'
import { splitRegistrations } from '@/utils/registration'

export function DashboardPage() {
  const { profile } = useAuth()
  const today = todayISO()
  const { data: registrations } = useMyRegistrations()
  const { upcoming } = splitRegistrations(registrations ?? [], today)
  const { data: matches } = useMatches('upcoming')
  const hasNext = (matches ?? []).some((m) => m.status !== 'CANCELLED')

  return (
    <div className="space-y-5">
      <PageHeader eyebrow={`${formatWeekday(today)}, ${formatShortDate(today).replace(/ \d{4}$/, '')}`} title={`Hi ${profile?.full_name.split(' ')[0] ?? 'there'}`} />

      <MyDuesCard />

      <NextMatchHero basePath="/matches" actionLabel="View match" />

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-extrabold">My registrations</h2>
            <Link to="/my-registrations" className="text-sm font-bold text-brand hover:underline">
              See all
            </Link>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((r) => (
              <RegistrationItem key={r.id} registration={r} />
            ))}
          </div>
        </section>
      )}

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-extrabold">Coming up</h2>
          <Link to="/matches" className="text-sm font-bold text-brand hover:underline">
            All matches
          </Link>
        </div>
        <MatchList
          scope="upcoming"
          basePath="/matches"
          actionLabel="View match"
          emptyText={hasNext ? 'Nothing else scheduled yet.' : 'No upcoming matches yet. Check back soon.'}
          hideCancelled
          variant="row"
          skip={1}
        />
      </section>
    </div>
  )
}
