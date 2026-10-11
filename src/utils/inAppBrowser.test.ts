import { describe, expect, it } from 'vitest'
import { isInAppBrowser } from './inAppBrowser'

describe('isInAppBrowser', () => {
  it('detects Instagram, Facebook and Android WebView browsers', () => {
    const instagram = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0'
    const facebook = 'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 Mobile Safari/537.36 [FBAN/FB4A;FBAV/400.0]'
    const webview = 'Mozilla/5.0 (Linux; Android 13; Pixel 7 Build/TQ3A; wv) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
    for (const ua of [instagram, facebook, webview]) expect(isInAppBrowser(ua)).toBe(true)
  })

  it('lets normal Chrome and Safari through', () => {
    const chrome = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120.0 Mobile Safari/537.36'
    const safari = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile/15E148 Safari/604.1'
    for (const ua of [chrome, safari, '']) expect(isInAppBrowser(ua)).toBe(false)
  })
})
