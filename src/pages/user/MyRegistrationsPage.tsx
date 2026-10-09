import { RegistrationItem } from '@/components/RegistrationItem'
import { Button } from '@/components/ui/button'
import { useMyRegistrations } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import { todayISO } from '@/utils/dates'
import { splitRegistrations } from '@/utils/registration'

export function MyRegistrationsPage() {
  const { data, isLoading, error, refetch } = useMyRegistrations()

  if (isLoading) return <p className="text-slate-500">Loading your registrations...</p>
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-red-600">
          {toFriendlyMessage(error)}
        </p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const { upcoming, history } = splitRegistrations(data ?? [], todayISO())
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">My registrations</h1>
      <section className="space-y-3">
        <h2 className="font-semibold text-slate-700">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-slate-500">You have no upcoming registrations.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {upcoming.map((r) => (
              <RegistrationItem key={r.id} registration={r} />
            ))}
          </div>
        )}
      </section>
      {history.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-semibold text-slate-700">History</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {history.map((r) => (
              <RegistrationItem key={r.id} registration={r} />
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
