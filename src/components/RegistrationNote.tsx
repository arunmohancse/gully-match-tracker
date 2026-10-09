import { brand } from '@/config/brand'
import type { Match } from '@/types/domain'
import { hasPayments } from '@/utils/cost'

/** The community's rule about paying your share, shown wherever a player registers. Hidden for free matches. */
export function RegistrationNote({ match }: { match: Match }) {
  if (!brand.registrationNote || !hasPayments(match)) return null
  return (
    <p className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">
      <span className="font-semibold">Note:</span> {brand.registrationNote}
    </p>
  )
}
