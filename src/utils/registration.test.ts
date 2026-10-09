import { describe, expect, it } from 'vitest'
import { AppError, isNetworkError, toFriendlyMessage } from '@/lib/errors'
import type { Match, RegistrationWithMatch } from '@/types/domain'
import { listLabel, registrationWindow, splitRegistrations } from './registration'

const base = { status: 'OPEN' as Match['status'], registration_opens_at: null, registration_closes_at: null }
const now = new Date('2026-10-10T12:00:00Z')

describe('registrationWindow', () => {
  it('is open for OPEN and FULL matches with no time limits', () => {
    expect(registrationWindow(base, now)).toBe('OPEN')
    expect(registrationWindow({ ...base, status: 'FULL' }, now)).toBe('OPEN')
  })
  it('is closed for other statuses', () => {
    for (const status of ['DRAFT', 'CLOSED', 'COMPLETED', 'CANCELLED'] as const) {
      expect(registrationWindow({ ...base, status }, now)).toBe('CLOSED')
    }
  })
  it('respects opening and closing times', () => {
    expect(registrationWindow({ ...base, registration_opens_at: '2026-10-11T00:00:00Z' }, now)).toBe('NOT_YET')
    expect(registrationWindow({ ...base, registration_closes_at: '2026-10-10T11:00:00Z' }, now)).toBe('CLOSED')
  })
})

describe('splitRegistrations', () => {
  const reg = (id: string, status: 'ACTIVE' | 'CANCELLED', date: string, matchStatus: Match['status'] = 'OPEN') =>
    ({ id, status, match: { match_date: date, start_time: '06:00:00', status: matchStatus } }) as unknown as RegistrationWithMatch
  it('separates upcoming active registrations from history, soonest first', () => {
    const { upcoming, history } = splitRegistrations(
      [
        reg('later', 'ACTIVE', '2026-11-01'),
        reg('sooner', 'ACTIVE', '2026-10-20'),
        reg('cancelled', 'CANCELLED', '2026-10-25'),
        reg('past', 'ACTIVE', '2026-09-01'),
        reg('match-cancelled', 'ACTIVE', '2026-10-30', 'CANCELLED'),
      ],
      '2026-10-10',
    )
    expect(upcoming.map((r) => r.id)).toEqual(['sooner', 'later'])
    expect(history.map((r) => r.id).sort()).toEqual(['cancelled', 'match-cancelled', 'past'])
  })
})

describe('listLabel', () => {
  it('formats list and position', () => {
    expect(listLabel('MAIN_LIST', 8)).toBe('Main list #8')
    expect(listLabel('WAITING_LIST', 1)).toBe('Waiting list #1')
    expect(listLabel('WAITING_LIST', null)).toBe('Waiting list')
  })
})

describe('error mapping', () => {
  it('maps database error codes to friendly messages', () => {
    expect(toFriendlyMessage({ message: 'REGISTRATION_CLOSED' })).toBe('Registration is currently closed.')
    expect(toFriendlyMessage({ message: 'permission denied for table registrations' })).toBe("You don't have permission to do that.")
  })
  it('maps cancellation and admin move codes', () => {
    expect(toFriendlyMessage({ message: 'CANCELLATION_CLOSED' })).toContain('no longer cancel')
    expect(toFriendlyMessage({ message: 'MAIN_LIST_FULL' })).toContain('main list is full')
    expect(toFriendlyMessage({ message: 'CAPACITY_BELOW_REGISTERED' })).toContain('cannot be lower')
  })
  it('never leaks raw database text', () => {
    expect(toFriendlyMessage({ message: 'duplicate key value violates unique constraint "registrations_match_user_key"' })).toBe(
      'Something went wrong. Please try again.',
    )
  })
  it('keeps messages of errors we already converted', () => {
    expect(toFriendlyMessage(new AppError('Registration is currently closed.'))).toBe('Registration is currently closed.')
  })
  it('detects network problems and timeouts', () => {
    expect(isNetworkError(new TypeError('Failed to fetch'))).toBe(true)
    expect(isNetworkError({ message: 'TimeoutError: The operation timed out.' })).toBe(true)
    expect(isNetworkError({ message: 'REGISTRATION_CLOSED' })).toBe(false)
  })
})
