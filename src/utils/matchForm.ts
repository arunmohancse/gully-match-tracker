import type { CostModel, Match, MatchInput } from '@/types/domain'
import { fromLocalInput, toLocalInput } from './dates'

export interface MatchFormValues {
  title: string
  description: string
  matchDate: string
  startTime: string
  endTime: string
  venue: string
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
    maxPlayers: String(m.max_players),
    costModel: m.cost_model ?? 'FIXED_FEE',
    registrationFee: String(m.registration_fee),
    opensAt: toLocalInput(m.registration_opens_at),
    closesAt: toLocalInput(m.registration_closes_at),
    rules: m.rules ?? '',
  }
}

export function validateMatchForm(v: MatchFormValues): MatchFormErrors {
  const e: MatchFormErrors = {}
  if (!v.title.trim()) e.title = 'Enter a title.'
  if (!v.venue.trim()) e.venue = 'Enter the venue.'
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

  if (v.opensAt && v.closesAt && new Date(v.closesAt) <= new Date(v.opensAt)) {
    e.closesAt = 'Closing time must be after the opening time.'
  }
  return e
}

/** Call only after validateMatchForm returns no errors. */
export function formToInput(v: MatchFormValues, imagePath: string | null): MatchInput {
  const blankToNull = (s: string) => (s.trim() ? s.trim() : null)
  return {
    title: v.title.trim(),
    description: blankToNull(v.description),
    match_date: v.matchDate,
    start_time: v.startTime,
    end_time: v.endTime || null,
    venue: v.venue.trim(),
    max_players: Number(v.maxPlayers),
    registration_fee: v.costModel === 'SHARED_COST' ? 0 : Number(v.registrationFee),
    cost_model: v.costModel,
    registration_opens_at: fromLocalInput(v.opensAt),
    registration_closes_at: fromLocalInput(v.closesAt),
    rules: blankToNull(v.rules),
    image_path: imagePath,
  }
}
