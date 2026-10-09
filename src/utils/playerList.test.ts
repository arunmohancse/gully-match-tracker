import { describe, expect, it } from 'vitest'
import type { AdminRegistration, Match } from '@/types/domain'
import { buildPlayerListMessage } from './playerList'

const match = {
  id: 'm1', title: 'Sunday Match', match_date: '2026-10-18', start_time: '06:00:00', end_time: '08:00:00',
  venue: 'Velocity Turf', max_players: 3, status: 'OPEN',
} as Match

const reg = (name: string, list: 'MAIN_LIST' | 'WAITING_LIST', pos: number, status: 'ACTIVE' | 'CANCELLED' = 'ACTIVE'): AdminRegistration =>
  ({ status, list_type: list, list_position: pos, player: { full_name: name, phone: null } }) as AdminRegistration

describe('buildPlayerListMessage', () => {
  it('lists main and waiting players in position order and skips cancelled ones', () => {
    const text = buildPlayerListMessage(
      match,
      [reg('Bala', 'MAIN_LIST', 2), reg('Arun', 'MAIN_LIST', 1), reg('Chitra', 'WAITING_LIST', 1), reg('Gone', 'MAIN_LIST', 3, 'CANCELLED')],
      'https://x.test/matches/m1',
    )
    expect(text).toContain('*SUNDAY MATCH*')
    expect(text).toContain('*Main list (2/3)*\n1. Arun\n2. Bala')
    expect(text).toContain('*Waiting list (1)*\n1. Chitra')
    expect(text).not.toContain('Gone')
    expect(text).toContain('1 spot left.')
    expect(text).toContain('Register here:\nhttps://x.test/matches/m1')
    expect(text.toLowerCase()).not.toContain('cancel')
    expect(text.endsWith('https://x.test/matches/m1')).toBe(true)
  })
  it('handles an empty list and omits the waiting list when nobody is waiting', () => {
    const text = buildPlayerListMessage(match, [], 'u')
    expect(text).toContain('*Main list (0/3)*\nNo players yet')
    expect(text).not.toContain('Waiting list')
    expect(text).toContain('3 spots left.')
  })
  it('does not advertise spots once the match is full or closed', () => {
    const full = buildPlayerListMessage({ ...match, status: 'FULL' }, [reg('A', 'MAIN_LIST', 1), reg('B', 'MAIN_LIST', 2), reg('C', 'MAIN_LIST', 3)], 'u')
    expect(full).not.toContain('left.')
    expect(full).toContain('Join the waiting list here:')
    const closed = buildPlayerListMessage({ ...match, status: 'CLOSED' }, [], 'u')
    expect(closed).not.toContain('left.')
    expect(closed).toContain('Match details:')
  })
  it('adds the share note for matches with a cost, but not for free matches', () => {
    const paid = buildPlayerListMessage({ ...match, cost_model: 'SHARED_COST' }, [], 'u')
    expect(paid).toContain('Note: If your name is on the list, you are responsible for your match share, whether you attend or not.')
    expect(paid.indexOf('Note:')).toBeLessThan(paid.indexOf('Register here:'))
    expect(buildPlayerListMessage({ ...match, cost_model: 'FIXED_FEE', registration_fee: 0 }, [], 'u')).not.toContain('Note:')
  })
})
