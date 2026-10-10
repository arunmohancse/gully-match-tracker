import { describe, expect, it } from 'vitest'
import { isGoogleMapsUrl } from './mapLink'

describe('isGoogleMapsUrl', () => {
  it('accepts the links Google Maps gives out', () => {
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/AbCd1234')).toBe(true) // Share > Copy link on a phone
    expect(isGoogleMapsUrl('https://share.google/GJGrOzq250tKeY050')).toBe(true) // shared from the Google app / Search
    expect(isGoogleMapsUrl('https://goo.gl/maps/AbCd1234')).toBe(true)
    expect(isGoogleMapsUrl('https://www.google.com/maps/place/Bellin+Turf/@8.5,76.9,17z')).toBe(true)
    expect(isGoogleMapsUrl('https://www.google.com/maps?q=8.5,76.9')).toBe(true)
    expect(isGoogleMapsUrl('https://google.co.in/maps/place/x')).toBe(true)
    expect(isGoogleMapsUrl('https://maps.google.com/?q=8.5,76.9')).toBe(true)
    expect(isGoogleMapsUrl('  https://maps.app.goo.gl/AbCd1234  ')).toBe(true) // pasted with spaces around it
  })
  it('rejects other sites, look-alike hosts and tricks in the address', () => {
    expect(isGoogleMapsUrl('https://example.com/maps/abc')).toBe(false)
    expect(isGoogleMapsUrl('https://google.com.evil.com/maps/x')).toBe(false)
    expect(isGoogleMapsUrl('https://maps.app.goo.gl.evil.com/x')).toBe(false)
    expect(isGoogleMapsUrl('https://maps.app.goo.gl@evil.com/x')).toBe(false)
    expect(isGoogleMapsUrl('https://www.google.com/search?q=maps')).toBe(false)
    expect(isGoogleMapsUrl('https://www.google.com/mapsfoo')).toBe(false)
    expect(isGoogleMapsUrl('https://goo.gl/other/abc')).toBe(false)
    expect(isGoogleMapsUrl('https://share.google')).toBe(false) // no link after the host
    expect(isGoogleMapsUrl('https://share.google.evil.com/abc')).toBe(false)
  })
  it('rejects plain http, other schemes, empty, spaced and over-long text', () => {
    expect(isGoogleMapsUrl('http://maps.app.goo.gl/abc')).toBe(false)
    expect(isGoogleMapsUrl('javascript:alert(1)')).toBe(false)
    expect(isGoogleMapsUrl('')).toBe(false)
    expect(isGoogleMapsUrl('Bellin Turf Kochuveli')).toBe(false)
    expect(isGoogleMapsUrl('https://maps.app.goo.gl/abc def')).toBe(false)
    expect(isGoogleMapsUrl(`https://maps.app.goo.gl/${'a'.repeat(500)}`)).toBe(false)
  })
})
