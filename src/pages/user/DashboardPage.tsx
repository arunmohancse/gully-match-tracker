import { Link } from 'react-router-dom'
import { MatchList } from '@/components/MatchList'
import { RegistrationItem } from '@/components/RegistrationItem'
import { useAuth } from '@/hooks/useAuth'
import { useMyRegistrations } from '@/hooks/useRegistrations'
import { todayISO } from '@/utils/dates'
import { splitRegistrations } from '@/utils/registration'

export function DashboardPage() {
  const { profile } = useAuth()
  const { data: registrations } = useMyRegistrations()
  const { upcoming } = splitRegistrations(registrations ?? [], todayISO())

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Hi {profile?.full_name.split(' ')[0]}</h1>

      {upcoming.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-slate-700">My registrations</h2>
            <Link to="/my-registrations" className="text-sm font-medium text-brand underline">
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
        <h2 className="font-semibold text-slate-700">Upcoming matches</h2>
        <MatchList scope="upcoming" basePath="/matches" actionLabel="View match" emptyText="No upcoming matches yet. Check back soon." hideCancelled />
      </section>
    </div>
  )
}
