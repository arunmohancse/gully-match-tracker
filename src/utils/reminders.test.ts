import { describe, expect, it, vi } from 'vitest'
import { AppError } from '@/lib/errors'
import { WhatsAppClickService } from '@/services/notifications/WhatsAppClickService'
import type { AdminRegistration, Match } from '@/types/domain'
import { canRemind } from './reminders'
import { buildReminderMessage, buildWhatsAppChatUrl } from './whatsapp'

const match = {
  id: 'm1', title: 'Gully League Community Match', match_date: '2026-10-18', start_time: '06:00:00', end_time: '08:00:00',
  venue: 'Velocity Turf', max_players: 20, registration_fee: 150, cost_model: 'FIXED_FEE', status: 'OPEN',
} as Match

const reg = (over: Partial<AdminRegistration> = {}) =>
  ({ id: 'r1', status: 'ACTIVE', list_type: 'MAIN_LIST', payment_status: 'UNPAID', player: { full_name: 'Arun Kumar', phone: '+919876543210' }, ...over }) as AdminRegistration

describe('buildReminderMessage', () => {
  const text = buildReminderMessage('Arun Kumar', match)
  it('greets by first name and includes match details and fee', () => {
    expect(text).toContain('Hi Arun,')
    expect(text).toContain('Gully League Community Match')
    expect(text).toContain('Date: 18 October 2026')
    expect(text).toContain('Time: 6:00 AM - 8:00 AM')
    expect(text).toContain('Venue: Velocity Turf')
    expect(text).toContain('Registration fee: ₹150')
    expect(text).toContain('Please complete the payment before the match.')
  })
  it('shared-cost reminders state the share and the payment details', () => {
    const shared = { ...match, cost_model: 'SHARED_COST' as const, registration_fee: 0, status: 'CLOSED' as const }
    const text = buildReminderMessage('Arun Kumar', shared, { amount: 156, instructions: 'UPI: club@upi' })
    expect(text).toContain('Payment reminder for the match: Gully League Community Match.')
    expect(text).toContain('Your share of the match expenses: ₹156')
    expect(text).toContain('Payment details:\nUPI: club@upi')
    expect(text).not.toContain('Registration fee')
  })
  it('fixed-fee reminders can carry payment details too, and omit the block when there are none', () => {
    expect(buildReminderMessage('Arun', match, { instructions: '  ' })).not.toContain('Payment details')
    expect(buildReminderMessage('Arun', match, { instructions: 'UPI: x@upi' })).toContain('UPI: x@upi')
  })
  it('adds the map location only for an upcoming match, not for payment-only reminders', () => {
    const link = 'https://maps.app.goo.gl/abc123'
    expect(buildReminderMessage('Arun', match)).not.toContain('Location')
    expect(buildReminderMessage('Arun', { ...match, map_url: link })).toContain(`Venue: Velocity Turf\nLocation: ${link}`)
    expect(buildReminderMessage('Arun', { ...match, map_url: link, status: 'COMPLETED' })).not.toContain('Location')
    expect(buildReminderMessage('Arun', { ...match, map_url: link, cost_model: 'SHARED_COST' })).not.toContain('Location')
  })
  it('uses "payment pending" wording once the match is completed', () => {
    const done = buildReminderMessage('Arun Kumar', { ...match, status: 'COMPLETED' })
    expect(done).toContain('Payment is still pending for the match: Gully League Community Match.')
    expect(done).toContain('Amount due: ₹150')
    expect(done).not.toContain('before the match')
  })
  it('contains no emojis (they get garbled by WhatsApp Desktop on Windows)', () => {
    expect(/\p{Extended_Pictographic}/u.test(text)).toBe(false)
  })
  it('copes with an empty name', () => {
    expect(buildReminderMessage('  ', match)).toContain('Hi there,')
  })
})

describe('buildWhatsAppChatUrl', () => {
  it('uses only the digits of the number and encodes the text', () => {
    expect(buildWhatsAppChatUrl('+91 98765-43210', 'Hi there\nBye')).toBe('https://wa.me/919876543210?text=Hi%20there%0ABye')
  })
  it('rejects unusable numbers', () => {
    expect(buildWhatsAppChatUrl('123', 'x')).toBeNull()
    expect(buildWhatsAppChatUrl('', 'x')).toBeNull()
  })
})

describe('canRemind', () => {
  it('is true for an unpaid main-list player of an upcoming paid match', () => {
    expect(canRemind(reg(), match)).toBe(true)
    expect(canRemind(reg(), { ...match, status: 'CLOSED' })).toBe(true)
    expect(canRemind(reg(), { ...match, status: 'COMPLETED' })).toBe(true)
  })
  it('shared cost: only once the share has been calculated', () => {
    const shared = { ...match, cost_model: 'SHARED_COST' as const, registration_fee: 0, status: 'CLOSED' as const }
    expect(canRemind(reg({ amount_due: null }), shared)).toBe(false)
    expect(canRemind(reg({ amount_due: 156 }), shared)).toBe(true)
    expect(canRemind(reg({ amount_due: 156, payment_status: 'PAID' }), shared)).toBe(false)
  })
  it('is false when paid, waived, waiting, cancelled, or the match is free / draft / cancelled', () => {
    expect(canRemind(reg({ payment_status: 'PAID' }), match)).toBe(false)
    expect(canRemind(reg({ payment_status: 'WAIVED' }), match)).toBe(false)
    expect(canRemind(reg({ list_type: 'WAITING_LIST' }), match)).toBe(false)
    expect(canRemind(reg({ status: 'CANCELLED' }), match)).toBe(false)
    expect(canRemind(reg(), { ...match, registration_fee: 0 })).toBe(false)
    expect(canRemind(reg(), { ...match, status: 'DRAFT' })).toBe(false)
    expect(canRemind(reg(), { ...match, status: 'CANCELLED' })).toBe(false)
  })
})

describe('WhatsAppClickService', () => {
  it('opens a chat with the player and detaches the opener', async () => {
    const popup = { opener: 'window' as unknown }
    const open = vi.fn(() => popup)
    await new WhatsAppClickService(open).sendPaymentReminder({ name: 'Arun Kumar', phone: '+919876543210' }, match)
    expect(open).toHaveBeenCalledOnce()
    expect((open.mock.calls[0] as unknown as [string])[0]).toMatch(/^https:\/\/wa\.me\/919876543210\?text=/)
    expect(popup.opener).toBeNull()
  })
  it('opens the window before any async work (needed so browsers do not block it)', () => {
    const open = vi.fn(() => ({ opener: null }))
    void new WhatsAppClickService(open).sendPaymentReminder({ name: 'A', phone: '+919876543210' }, match)
    expect(open).toHaveBeenCalledOnce()   // already called, with no await in between
  })
  it('explains when the browser blocks the window', async () => {
    await expect(new WhatsAppClickService(() => null).sendPaymentReminder({ name: 'A', phone: '+919876543210' }, match)).rejects.toThrow(AppError)
  })
  it('refuses players without a usable phone number and opens nothing', async () => {
    const open = vi.fn(() => ({ opener: null }))
    const service = new WhatsAppClickService(open)
    await expect(service.sendPaymentReminder({ name: 'A', phone: null }, match)).rejects.toThrow(/no phone/i)
    await expect(service.sendPaymentReminder({ name: 'A', phone: '12' }, match)).rejects.toThrow(/invalid/i)
    expect(open).not.toHaveBeenCalled()
  })
})
