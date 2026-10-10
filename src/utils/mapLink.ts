/** Hosts a pasted location link may point to. Spelled out in full, so "google.com.example.com" is rejected. Keep in step with migration 0017. */
const GOOGLE_MAPS_HOSTS = new Set(['maps.app.goo.gl', 'share.google', 'goo.gl', 'google.com', 'www.google.com', 'google.co.in', 'www.google.co.in', 'maps.google.com', 'maps.google.co.in'])

const MAX_LENGTH = 500

/** True for an https link that opens Google Maps (a Share > Copy link address, or a normal maps.google / google.com/maps address). */
export function isGoogleMapsUrl(value: string): boolean {
  const text = value.trim()
  if (!text || text.length > MAX_LENGTH || /\s/.test(text)) return false
  let url: URL
  try {
    url = new URL(text)
  } catch {
    return false
  }
  if (url.protocol !== 'https:' || url.username || url.password || !GOOGLE_MAPS_HOSTS.has(url.hostname.toLowerCase())) return false
  const path = url.pathname
  switch (url.hostname.toLowerCase()) {
    case 'maps.app.goo.gl':
    case 'share.google': // Google's short link when a place is shared from the Google app or Search
      return path.length > 1
    case 'goo.gl':
      return path.startsWith('/maps/')
    case 'maps.google.com':
    case 'maps.google.co.in':
      return true
    default:
      return path === '/maps' || path.startsWith('/maps/')
  }
}
