import { RegistrationItem } from '@/components/RegistrationItem'
import { Button } from '@/components/ui/button'
import { useMyRegistrations } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import { todayISO } from '@/utils/dates'
import { splitRegistrations } from '@/utils/registration'
import { PageHeader } from '@/components/PageHeader'
import { CricketLoader } from '@/components/CricketLoader'

export function MyRegistrationsPage() {
  const { data, isLoading, error, refetch } = useMyRegistrations()

  if (isLoading) return <CricketLoader label="Loading your registrations" />
  if (error) {
    return (
      <div className="space-y-2">
        <p role="alert" className="text-danger">
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
      <PageHeader title="My registrations" />
      <section className="space-y-3">
        <h2 className="font-extrabold">Upcoming</h2>
        {upcoming.length === 0 ? (
          <p className="text-subtle">You have no upcoming registrations.</p>
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
          <h2 className="font-extrabold">History</h2>
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
