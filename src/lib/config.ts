/** Public base URL used in shared links. Set VITE_PUBLIC_APP_URL in production; defaults to the current origin. */
export function appBaseUrl(): string {
  const configured = (import.meta.env.VITE_PUBLIC_APP_URL as string | undefined)?.trim()
  return (configured || window.location.origin).replace(/\/+$/, '')
}

export function matchShareUrl(matchId: string): string {
  return `${appBaseUrl()}/matches/${matchId}`
}
