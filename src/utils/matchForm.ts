import type { CostModel, Match, MatchInput } from '@/types/domain'
import { addDaysISO, fromLocalInput, toLocalInput } from './dates'
import { isGoogleMapsUrl } from './mapLink'

/** Registration dates are picked as a day only: it opens at the start of that day and closes at the end of it. */
const OPENS_TIME = '00:00'
const CLOSES_TIME = '23:59'

export interface MatchFormValues {
  title: string
  description: string
  matchDate: string
  startTime: string
  endTime: string
  venue: string
  mapUrl: string
  maxPlayers: string
  costModel: CostModel
  registrationFee: string
  opensAt: string
  closesAt: string
  rules: string
}

export type MatchFormErrors = Partial<Record<keyof MatchFormValues, string>>

export const EMPTY_FORM: MatchFormValues = {
  title: '',
  description: '',
  matchDate: '',
  startTime: '',
  endTime: '',
  venue: '',
  mapUrl: '',
  maxPlayers: '20',
  costModel: 'SHARED_COST',
  registrationFee: '0',
  opensAt: '',
  closesAt: '',
  rules: '',
}

export function matchToForm(m: Match): MatchFormValues {
  return {
    title: m.title,
    description: m.description ?? '',
    matchDate: m.match_date,
    startTime: m.start_time.slice(0, 5),
    endTime: m.end_time?.slice(0, 5) ?? '',
    venue: m.venue,
    mapUrl: m.map_url ?? '',
    maxPlayers: String(m.max_players),
    costModel: m.cost_model ?? 'FIXED_FEE',
    registrationFee: String(m.registration_fee),
    opensAt: toLocalInput(m.registration_opens_at).slice(0, 10),
    closesAt: toLocalInput(m.registration_closes_at).slice(0, 10),
    rules: m.rules ?? '',
  }
}

/**
 * Starting values for a new match copied from an existing one: every detail is kept, the date moves a week on
 * (matches are usually weekly), and the registration open/close days are cleared because they belonged to the old match.
 */
export function copyMatchToForm(m: Match): MatchFormValues {
  return { ...matchToForm(m), matchDate: addDaysISO(m.match_date, 7), opensAt: '', closesAt: '' }
}

export function validateMatchForm(v: MatchFormValues): MatchFormErrors {
  const e: MatchFormErrors = {}
  if (!v.title.trim()) e.title = 'Enter a title.'
  if (!v.venue.trim()) e.venue = 'Enter the venue.'
  if (v.mapUrl.trim() && !isGoogleMapsUrl(v.mapUrl)) e.mapUrl = 'Paste a Google Maps link (in Google Maps tap Share, then Copy link).'
  if (!v.matchDate) e.matchDate = 'Pick the match date.'
  if (!v.startTime) e.startTime = 'Pick a start time.'
  if (v.endTime && v.startTime && v.endTime <= v.startTime) e.endTime = 'End time must be after the start time.'

  const max = Number(v.maxPlayers)
  if (!v.maxPlayers.trim() || !Number.isInteger(max) || max < 1) e.maxPlayers = 'Enter a whole number of at least 1.'

  // The fee only applies to fixed-fee matches; shared-cost matches are priced after the match.
  if (v.costModel === 'FIXED_FEE') {
    const fee = Number(v.registrationFee)
    if (!v.registrationFee.trim() || Number.isNaN(fee) || fee < 0) e.registrationFee = 'Enter 0 or more.'
  }

  if (v.opensAt && v.closesAt && v.closesAt < v.opensAt) {
    e.closesAt = 'The closing date cannot be before the opening date.'
  }
  return e
}

/**
 * Day picked in the form -> timestamp. When editing and the day is unchanged, the match's existing timestamp
 * is kept, so saving an older match does not move a time that was set with the old date-and-time fields.
 */
function dayToTimestamp(day: string, time: string, existing: string | null | undefined): string | null {
  if (!day) return null
  if (existing && toLocalInput(existing).slice(0, 10) === day) return existing
  return fromLocalInput(`${day}T${time}`)
}

/** Call only after validateMatchForm returns no errors. `original` is the match being edited, if any. */
export function formToInput(v: MatchFormValues, imagePath: string | null, original?: Match | null): MatchInput {
  const blankToNull = (s: string) => (s.trim() ? s.trim() : null)
  return {
    title: v.title.trim(),
    description: blankToNull(v.description),
    match_date: v.matchDate,
    start_time: v.startTime,
    end_time: v.endTime || null,
    venue: v.venue.trim(),
    map_url: blankToNull(v.mapUrl),
    max_players: Number(v.maxPlayers),
    registration_fee: v.costModel === 'SHARED_COST' ? 0 : Number(v.registrationFee),
    cost_model: v.costModel,
    registration_opens_at: dayToTimestamp(v.opensAt, OPENS_TIME, original?.registration_opens_at),
    registration_closes_at: dayToTimestamp(v.closesAt, CLOSES_TIME, original?.registration_closes_at),
    rules: blankToNull(v.rules),
    image_path: imagePath,
  }
}
