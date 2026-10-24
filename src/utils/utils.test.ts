import { describe, expect, it } from 'vitest'
import type { Match } from '@/types/domain'
import { buildAnnouncement } from './announcement'
import { addDaysISO, formatMatchDate, formatShortDate, formatTime, fromLocalInput, todayISO, toLocalInput } from './dates'
import { copyMatchToForm, EMPTY_FORM, formToInput, matchToForm, validateMatchForm } from './matchForm'
import { availableStatusActions, cancelAction, nextStepAction, secondaryStatusActions } from './matchStatus'
import { formatINR, parseMoney } from './money'

const match: Match = {
  id: 'm1',
  community_id: 'c1',
  title: 'Gully League Community Match',
  description: null,
  match_date: '2026-10-18',
  start_time: '06:00:00',
  end_time: '08:00:00',
  venue: 'Velocity Turf',
  map_url: null,
  max_players: 20,
  registration_fee: 150,
  cost_model: 'FIXED_FEE',
  registration_opens_at: null,
  registration_closes_at: null,
  rules: null,
  image_path: null,
  status: 'OPEN',
  created_at: '',
  updated_at: '',
}

describe('dates', () => {
  it('formats dates and times', () => {
    expect(formatMatchDate('2026-10-18')).toBe('18 October 2026')
    expect(formatShortDate('2026-10-18')).toBe('18 Oct 2026')
    expect(formatTime('06:00:00')).toBe('6:00 AM')
    expect(formatTime('12:30:00')).toBe('12:30 PM')
    expect(formatTime('00:05')).toBe('12:05 AM')
  })
  it('todayISO pads month and day', () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe('2026-01-05')
  })
  it('round-trips datetime-local values', () => {
    expect(toLocalInput(fromLocalInput('2026-10-17T18:30'))).toBe('2026-10-17T18:30')
    expect(fromLocalInput('')).toBeNull()
  })
})

describe('formatINR', () => {
  it('drops decimals for whole amounts', () => {
    expect(formatINR(150)).toBe('₹150')
    expect(formatINR('2000')).toBe('₹2,000')
    expect(formatINR(150.5)).toBe('₹150.50')
  })
})

describe('parseMoney', () => {
  it('accepts plain, comma and rupee-prefixed amounts', () => {
    expect(parseMoney('150')).toBe(150)
    expect(parseMoney('1,500.50')).toBe(1500.5)
    expect(parseMoney('₹ 200')).toBe(200)
  })
  it('rejects empty, negative, non-numeric and over-precise input', () => {
    for (const bad of ['', '-5', 'abc', '10.999', '1.2.3']) expect(parseMoney(bad)).toBeNull()
  })
})

describe('matchStatus transitions', () => {
  it('lets a draft be opened, published or cancelled', () => {
    expect(availableStatusActions('DRAFT').map((a) => a.to)).toEqual(['OPEN', 'UPCOMING', 'CANCELLED'])
  })
  it('treats COMPLETED and CANCELLED as terminal', () => {
    expect(availableStatusActions('COMPLETED')).toEqual([])
    expect(availableStatusActions('CANCELLED')).toEqual([])
  })
  it('never offers FULL as a manual target', () => {
    for (const s of ['DRAFT', 'UPCOMING', 'OPEN', 'FULL', 'CLOSED'] as const) {
      expect(availableStatusActions(s).some((a) => a.to === 'FULL')).toBe(false)
    }
  })
})

describe('admin page actions', () => {
  it('picks the usual next step for each status, and none for a finished match', () => {
    expect(nextStepAction('DRAFT')?.to).toBe('UPCOMING')
    expect(nextStepAction('DRAFT')?.label).toBe('Publish match')
    expect(nextStepAction('DRAFT', true)?.to).toBe('OPEN') // a future opening day: live now, the database holds registration back
    expect(nextStepAction('DRAFT', true)?.label).toBe('Publish match')
    expect(nextStepAction('UPCOMING')?.to).toBe('OPEN')
    expect(nextStepAction('OPEN')?.to).toBe('CLOSED')
    expect(nextStepAction('FULL')?.to).toBe('CLOSED')
    expect(nextStepAction('CLOSED')?.to).toBe('COMPLETED')
    expect(nextStepAction('COMPLETED')).toBeNull()
    expect(nextStepAction('CANCELLED')).toBeNull()
  })
  it('keeps the other changes as quiet links and cancelling out of them', () => {
    expect(secondaryStatusActions('DRAFT').map((a) => [a.to, a.label])).toEqual([['OPEN', 'Open registration now']])
    expect(secondaryStatusActions('DRAFT', true)).toEqual([]) // already published by the big button
    expect(secondaryStatusActions('UPCOMING').map((a) => a.to)).toEqual(['DRAFT'])
    expect(secondaryStatusActions('OPEN').map((a) => a.to)).toEqual(['COMPLETED'])
    expect(secondaryStatusActions('CLOSED').map((a) => [a.to, a.label])).toEqual([['OPEN', 'Reopen registration']])
    expect(secondaryStatusActions('COMPLETED')).toEqual([])
  })
  it('offers cancelling only while a match can still be cancelled, never twice', () => {
    for (const s of ['DRAFT', 'UPCOMING', 'OPEN', 'FULL', 'CLOSED'] as const) {
      expect(cancelAction(s)?.to).toBe('CANCELLED')
      const all = [nextStepAction(s), ...secondaryStatusActions(s), cancelAction(s)].map((a) => a?.to)
      expect(new Set(all).size).toBe(all.length) // every status change is reachable from exactly one place
    }
    expect(cancelAction('COMPLETED')).toBeNull()
    expect(cancelAction('CANCELLED')).toBeNull()
  })
})

describe('matchForm', () => {
  const valid = { ...EMPTY_FORM, title: 'T', venue: 'V', matchDate: '2026-10-18', startTime: '06:00' }
  it('accepts a minimal valid form', () => {
    expect(validateMatchForm(valid)).toEqual({})
  })
  it('flags required and invalid fields', () => {
    const errors = validateMatchForm({ ...EMPTY_FORM, costModel: 'FIXED_FEE', maxPlayers: '0', registrationFee: '-1' })
    expect(Object.keys(errors).sort()).toEqual(['matchDate', 'maxPlayers', 'registrationFee', 'startTime', 'title', 'venue'])
  })
  it('requires end after start and close after open', () => {
    const errors = validateMatchForm({ ...valid, endTime: '05:00', opensAt: '2026-10-10', closesAt: '2026-10-09' })
    expect(errors.endTime).toBeDefined()
    expect(errors.closesAt).toBeDefined()
    expect(validateMatchForm({ ...valid, opensAt: '2026-10-10', closesAt: '2026-10-10' }).closesAt).toBeUndefined() // same day is fine
  })
  it('registration days become start-of-day and end-of-day, and unchanged days keep the saved time when editing', () => {
    const input = formToInput({ ...valid, opensAt: '2026-10-10', closesAt: '2026-10-17' }, null)
    expect(toLocalInput(input.registration_opens_at)).toBe('2026-10-10T00:00')
    expect(toLocalInput(input.registration_closes_at)).toBe('2026-10-17T23:59')
    const saved = fromLocalInput('2026-10-17T18:30')
    const edited = formToInput({ ...valid, opensAt: '', closesAt: '2026-10-17' }, null, { registration_opens_at: null, registration_closes_at: saved } as Match)
    expect(edited.registration_closes_at).toBe(saved)
    expect(edited.registration_opens_at).toBeNull()
    const moved = formToInput({ ...valid, opensAt: '', closesAt: '2026-10-18' }, null, { registration_opens_at: null, registration_closes_at: saved } as Match)
    expect(toLocalInput(moved.registration_closes_at)).toBe('2026-10-18T23:59')
  })
  it('the opening time is optional, needs an opening day, and round-trips through the form', () => {
    const timed = formToInput({ ...valid, opensAt: '2026-10-14', opensTime: '09:30' }, null)
    expect(toLocalInput(timed.registration_opens_at)).toBe('2026-10-14T09:30')
    expect(validateMatchForm({ ...valid, opensTime: '09:30' }).opensTime).toBeDefined()
    expect(validateMatchForm({ ...valid, opensAt: '2026-10-14', opensTime: '09:30' }).opensTime).toBeUndefined()
    const back = matchToForm({ ...match, registration_opens_at: timed.registration_opens_at } as Match)
    expect(back).toMatchObject({ opensAt: '2026-10-14', opensTime: '09:30' })
    expect(matchToForm({ ...match, registration_opens_at: fromLocalInput('2026-10-14T00:00') } as Match).opensTime).toBe('')
  })
  it('converts blanks to null and numbers to numbers', () => {
    const input = formToInput({ ...valid, costModel: 'FIXED_FEE', maxPlayers: '20', registrationFee: '150' }, null)
    expect(input).toMatchObject({ description: null, end_time: null, max_players: 20, registration_fee: 150, cost_model: 'FIXED_FEE', rules: null })
  })
  it('shared-cost matches ignore the fee field and store a fee of 0', () => {
    expect(validateMatchForm({ ...valid, costModel: 'SHARED_COST', registrationFee: 'junk' })).toEqual({})
    expect(formToInput({ ...valid, costModel: 'SHARED_COST', registrationFee: '150' }, null)).toMatchObject({ cost_model: 'SHARED_COST', registration_fee: 0 })
  })
  it('new matches default to shared cost', () => {
    expect(EMPTY_FORM.costModel).toBe('SHARED_COST')
  })
  it('a copied match keeps its details, moves a week on, and drops the registration window', () => {
    const source = { ...match, map_url: 'https://maps.app.goo.gl/abc123', rules: 'Bring shoes', registration_opens_at: '2026-10-10T00:00:00Z', registration_closes_at: '2026-10-17T18:29:00Z' } as Match
    const copy = copyMatchToForm(source)
    expect(copy).toMatchObject({ title: source.title, venue: 'Velocity Turf', mapUrl: 'https://maps.app.goo.gl/abc123', rules: 'Bring shoes', startTime: '06:00', endTime: '08:00', maxPlayers: '20', costModel: 'FIXED_FEE', registrationFee: '150' })
    expect(copy.matchDate).toBe('2026-10-25')
    expect(copy.opensAt).toBe('')
    expect(copy.closesAt).toBe('')
    expect(validateMatchForm(copy)).toEqual({}) // ready to save as it is
  })
  it('the map link is optional, must be a Google Maps link, and is stored trimmed or as null', () => {
    expect(validateMatchForm({ ...valid, mapUrl: '' }).mapUrl).toBeUndefined()
    expect(validateMatchForm({ ...valid, mapUrl: 'https://maps.app.goo.gl/abc123' }).mapUrl).toBeUndefined()
    expect(validateMatchForm({ ...valid, mapUrl: 'https://example.com/maps/abc' }).mapUrl).toBeDefined()
    expect(formToInput({ ...valid, mapUrl: '  https://maps.app.goo.gl/abc123 ' }, null).map_url).toBe('https://maps.app.goo.gl/abc123')
    expect(formToInput({ ...valid, mapUrl: '  ' }, null).map_url).toBeNull()
  })
})

describe('addDaysISO', () => {
  it('moves a date across month and year ends', () => {
    expect(addDaysISO('2026-10-18', 7)).toBe('2026-10-25')
    expect(addDaysISO('2026-10-28', 7)).toBe('2026-11-04')
    expect(addDaysISO('2026-12-28', 7)).toBe('2027-01-04')
    expect(addDaysISO('2026-03-02', -3)).toBe('2026-02-27')
  })
})

describe('buildAnnouncement', () => {
  it('includes key match details and the link', () => {
    const text = buildAnnouncement(match, 'https://x.test/matches/m1')
    expect(text).toContain('*GULLY LEAGUE COMMUNITY MATCH*')
    expect(text).toContain('Date: 18 October 2026')
    expect(text).toContain('Time: 6:00 AM - 8:00 AM')
    expect(text).toContain('Venue: Velocity Turf')
    expect(text).toContain('Match Fee: ₹150')
    expect(text).toContain('Registration is now open.')
    expect(text).toContain('Register here:\nhttps://x.test/matches/m1')
  })
  it('has no cost line for shared-cost matches', () => {
    const text = buildAnnouncement({ ...match, cost_model: 'SHARED_COST', registration_fee: 0 }, 'https://x.test/matches/m1')
    expect(text).not.toContain('Cost')
    expect(text).not.toContain('Match Fee')
  })
  it('leaves the map link out so WhatsApp previews the site link, not the map', () => {
    const text = buildAnnouncement({ ...match, map_url: 'https://maps.app.goo.gl/abc123' }, 'https://x.test/matches/m1')
    expect(text).not.toContain('Location')
    expect(text).not.toContain('maps.app.goo.gl')
  })
  it('ends with the WhatsApp community invite, after the match link so WhatsApp still previews the match', () => {
    const text = buildAnnouncement(match, 'https://x.test/matches/m1', 'https://chat.whatsapp.com/abc')
    expect(text.endsWith('Join our WhatsApp community:\nhttps://chat.whatsapp.com/abc')).toBe(true)
    expect(text.indexOf('https://x.test/matches/m1')).toBeLessThan(text.indexOf('https://chat.whatsapp.com/abc'))
  })
  it('leaves the community line out when no community link is set', () => {
    expect(buildAnnouncement(match, 'https://x.test/matches/m1', '')).not.toContain('community')
  })
  it('omits the fee line when the match is free', () => {
    const text = buildAnnouncement({ ...match, registration_fee: 0 }, 'https://x.test/matches/m1')
    expect(text).not.toContain('Match Fee')
    expect(text).toContain('Maximum Players: 20')
  })
})
