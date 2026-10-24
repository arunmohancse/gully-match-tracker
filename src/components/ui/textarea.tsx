import * as React from 'react'
import { cn } from '@/lib/utils'

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'min-h-24 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-base placeholder:text-faint focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50',
        className,
      )}
      {...props}
    />
  )
}
