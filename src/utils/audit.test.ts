import { describe, expect, it } from 'vitest'
import { AUDIT_CATEGORIES, describeAudit, type AuditEntry, type AuditNames } from './audit'

const names: AuditNames = { users: { u1: 'Arun', u2: 'Rahul' }, matches: { m1: 'Sunday Match' } }
const entry = (over: Partial<AuditEntry>): AuditEntry => ({
  id: 'a1', action: 'X', entity_type: 'registration', entity_id: 'r1', metadata: {}, created_at: '2026-10-10T10:00:00Z',
  actor: { full_name: 'Admin Anu' }, ...over,
})

describe('describeAudit', () => {
  it('describes registrations and cancellations', () => {
    expect(describeAudit(entry({ action: 'REGISTRATION_CREATED', metadata: { user_id: 'u1', match_id: 'm1', list_type: 'WAITING_LIST' } }), names)).toBe(
      'Arun registered for "Sunday Match" (waiting list)',
    )
    expect(describeAudit(entry({ action: 'REGISTRATION_CANCELLED', metadata: { user_id: 'u1', match_id: 'm1', by_admin: false } }), names)).toBe(
      'Arun cancelled their registration for "Sunday Match"',
    )
    expect(describeAudit(entry({ action: 'REGISTRATION_CANCELLED', metadata: { user_id: 'u1', match_id: 'm1', by_admin: true } }), names)).toBe(
      'Admin Anu cancelled Arun\'s registration for "Sunday Match"',
    )
  })
  it('describes promotions and moves', () => {
    expect(describeAudit(entry({ action: 'PLAYER_PROMOTED', metadata: { user_id: 'u2', match_id: 'm1' } }), names)).toBe('Rahul was moved up to the main list for "Sunday Match"')
    expect(describeAudit(entry({ action: 'PLAYER_MOVED', metadata: { user_id: 'u2', match_id: 'm1', from: 'MAIN_LIST', to: 'WAITING_LIST' } }), names)).toBe(
      'Admin Anu moved Rahul from the main list to the waiting list for "Sunday Match"',
    )
  })
  it('describes payments with amount, method and reference', () => {
    expect(
      describeAudit(entry({ action: 'PAYMENT_MARKED_PAID', metadata: { user_id: 'u1', match_id: 'm1', amount: 150, method: 'UPI', reference: 'T123' } }), names),
    ).toBe('Admin Anu marked Arun as paid (₹150, UPI, ref T123) for "Sunday Match"')
    expect(describeAudit(entry({ action: 'PAYMENT_WAIVED', metadata: { user_id: 'u1', match_id: 'm1' } }), names)).toBe('Admin Anu waived Arun\'s fee for "Sunday Match"')
  })
  it('describes match changes using the match entity', () => {
    const m = { entity_type: 'match', entity_id: 'm1' }
    expect(describeAudit(entry({ ...m, action: 'MATCH_UPDATED', metadata: { changes: { max_players: { from: 20, to: 22 }, status: { from: 'OPEN', to: 'CLOSED' } } } }), names)).toBe(
      'Admin Anu updated the match "Sunday Match": maximum players, status (status OPEN → CLOSED)',
    )
    expect(describeAudit(entry({ ...m, action: 'MATCH_CANCELLED' }), names)).toBe('Admin Anu cancelled the match "Sunday Match"')
  })
  it('describes expenses and reminders', () => {
    expect(describeAudit(entry({ action: 'EXPENSE_ADDED', entity_type: 'expense', metadata: { match_id: 'm1', description: 'Turf', amount: 2000 } }), names)).toBe(
      'Admin Anu added an expense: Turf ₹2,000 for "Sunday Match"',
    )
    expect(describeAudit(entry({ action: 'REMINDER_OPENED', metadata: { user_id: 'u1', match_id: 'm1' } }), names)).toBe(
      'Admin Anu opened a WhatsApp reminder for Arun for "Sunday Match"',
    )
  })
  it('degrades gracefully for unknown people, matches and actions', () => {
    expect(describeAudit(entry({ action: 'PLAYER_PROMOTED', metadata: { user_id: 'gone' } }), names)).toBe('a player was moved up to the main list')
    expect(describeAudit(entry({ action: 'SOMETHING_NEW', actor: null }), names)).toBe('Someone: SOMETHING_NEW')
  })
})

describe('AUDIT_CATEGORIES', () => {
  it('covers every action once and leaves ALL unfiltered', () => {
    expect(AUDIT_CATEGORIES.ALL.actions).toEqual([])
    const all = Object.values(AUDIT_CATEGORIES).flatMap((c) => [...c.actions])
    expect(new Set(all).size).toBe(all.length)
    expect(all).toContain('REMINDER_OPENED')
    expect(all).toContain('MATCH_CANCELLED')
  })
  it('describes approvals, blocking and password actions', () => {
    expect(describeAudit(entry({ action: 'USER_STATUS_CHANGED', metadata: { user_id: 'u1', from: 'PENDING', to: 'ACTIVE' } }), names)).toBe('Admin Anu approved Arun')
    expect(describeAudit(entry({ action: 'USER_STATUS_CHANGED', metadata: { user_id: 'u1', from: 'ACTIVE', to: 'BLOCKED' } }), names)).toBe('Admin Anu blocked Arun')
    expect(describeAudit(entry({ action: 'USER_STATUS_CHANGED', metadata: { user_id: 'u1', from: 'BLOCKED', to: 'ACTIVE' } }), names)).toBe('Admin Anu unblocked Arun')
    expect(describeAudit(entry({ action: 'PASSWORD_SET_BY_ADMIN', metadata: { user_id: 'u1' } }), names)).toBe('Admin Anu set a temporary password for Arun')
    expect(describeAudit(entry({ action: 'PASSWORD_RESET_USED', actor: null, metadata: { user_id: 'u1' } }), names)).toBe('Arun reset their password')
  })
})
