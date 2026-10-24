import type { ReactNode } from 'react'

/** Page title in the display face, with an optional small line above it and an action (e.g. "New match") on the right. */
export function PageHeader({ title, eyebrow, action }: { title: ReactNode; eyebrow?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="text-sm font-semibold text-subtle">{eyebrow}</p>}
        <h1 className="font-display text-[34px] font-bold leading-none">{title}</h1>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
