import { Monitor, Moon, Sun } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useTheme } from '@/hooks/useTheme'
import { cn } from '@/lib/utils'
import type { ThemePreference } from '@/lib/theme'

/** Header button: switches to the other theme. Picking "System" again is on the Profile page. */
export function ThemeToggle({ className }: { className?: string }) {
  const { resolved, setPreference } = useTheme()
  const next = resolved === 'dark' ? 'light' : 'dark'
  const Icon = resolved === 'dark' ? Sun : Moon
  return (
    <Button variant="ghost" size="sm" className={className} onClick={() => setPreference(next)} aria-label={`Switch to ${next} theme`}>
      <Icon className="size-4" aria-hidden />
    </Button>
  )
}

const OPTIONS: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
]

/** Profile card: Light / Dark / System. */
export function AppearanceCard() {
  const { preference, setPreference } = useTheme()
  return (
    <Card className="space-y-3">
      <h2 id="appearance" className="font-extrabold">
        Appearance
      </h2>
      <div role="radiogroup" aria-labelledby="appearance" className="grid grid-cols-3 gap-2">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const selected = preference === value
          return (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setPreference(value)}
              className={cn(
                'flex min-h-16 flex-col items-center justify-center gap-1 rounded-xl text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                selected ? 'border-2 border-brand bg-brand/10 text-brand' : 'border border-line bg-surface text-muted hover:bg-surface-3',
              )}
            >
              <Icon className="size-5" aria-hidden />
              {label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-subtle">System follows your phone's light or dark setting.</p>
    </Card>
  )
}
