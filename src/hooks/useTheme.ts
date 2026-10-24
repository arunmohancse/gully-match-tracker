import { useSyncExternalStore } from 'react'
import { getResolvedTheme, getThemePreference, setThemePreference, subscribeTheme } from '@/lib/theme'

/** The saved choice (light / dark / system), what is actually showing, and a setter. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribeTheme, getThemePreference)
  const resolved = useSyncExternalStore(subscribeTheme, getResolvedTheme)
  return { preference, resolved, setPreference: setThemePreference }
}
