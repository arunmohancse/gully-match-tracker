/**
 * Light / dark theme. The choice is kept per device in localStorage; "system" follows the phone's setting.
 * index.html runs the same logic inline before the first paint (so the page never flashes white) — keep the
 * storage key and the dark theme-color there in step with this file.
 */
export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'theme'
/** Browser UI color in dark mode: the page background, so the status bar blends in. */
export const DARK_THEME_COLOR = '#0a100c'

export function parseThemePreference(value: unknown): ThemePreference {
  return value === 'light' || value === 'dark' ? value : 'system'
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

const darkQuery = () => window.matchMedia('(prefers-color-scheme: dark)')

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system' // storage blocked (private mode, in-app browsers)
  }
}

let preference: ThemePreference = typeof window === 'undefined' ? 'system' : readPreference()
const listeners = new Set<() => void>()
let lightThemeColor: string | null = null

function apply() {
  const resolved = resolveTheme(preference, darkQuery().matches)
  const root = document.documentElement
  root.classList.toggle('dark', resolved === 'dark')
  root.style.colorScheme = resolved
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (meta) {
    lightThemeColor ??= meta.dataset.light ?? meta.content
    meta.content = resolved === 'dark' ? DARK_THEME_COLOR : lightThemeColor
  }
  listeners.forEach((l) => l())
}

export function getThemePreference(): ThemePreference {
  return preference
}

export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(preference, darkQuery().matches)
}

export function setThemePreference(next: ThemePreference) {
  preference = next
  try {
    if (next === 'system') localStorage.removeItem(THEME_STORAGE_KEY)
    else localStorage.setItem(THEME_STORAGE_KEY, next)
  } catch {
    // still applies for this visit
  }
  apply()
}

export function subscribeTheme(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Call once at startup: applies the saved choice and follows the phone's setting while on "system". */
export function initTheme() {
  darkQuery().addEventListener('change', () => {
    if (preference === 'system') apply()
  })
  apply()
}
