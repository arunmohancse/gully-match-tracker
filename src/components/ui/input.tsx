import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-base placeholder:text-faint focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
