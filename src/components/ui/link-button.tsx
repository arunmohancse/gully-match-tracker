import * as React from 'react'
import { cn } from '@/lib/utils'

/** A quiet text-style action: for secondary actions next to a primary button. Tall enough to tap on a phone. */
export function LinkButton({ className, type = 'button', ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn('inline-flex min-h-11 items-center text-sm font-medium text-brand underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50', className)}
      {...props}
    />
  )
}
