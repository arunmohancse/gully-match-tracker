/** Apps whose built-in browser Google refuses to sign in from (error 403: disallowed_useragent). */
const IN_APP_MARKERS = /FBAN|FBAV|FB_IAB|Instagram|WhatsApp|Line\/|Snapchat|Twitter|LinkedInApp|MicroMessenger|; wv\)/i

export function isInAppBrowser(userAgent: string): boolean {
  return IN_APP_MARKERS.test(userAgent)
}
