import * as React from 'react'
import { cn } from '@/lib/utils'

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'h-11 w-full rounded-md border border-slate-300 bg-white px-3 text-base placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
