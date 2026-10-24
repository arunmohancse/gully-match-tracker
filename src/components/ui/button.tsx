import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-xl text-sm font-bold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-brand text-brand-foreground hover:bg-brand/90',
        outline: 'border border-line-strong bg-surface hover:bg-surface-3',
        destructive: 'bg-danger-solid text-white hover:bg-danger-solid/90',
        ghost: 'hover:bg-surface-3',
      },
      size: { default: 'h-11 px-4', sm: 'h-10 px-3', lg: 'h-12 px-6 text-base' },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export function Button({ className, variant, size, asChild, loading, disabled, children, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'
  return (
    <Comp className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
      {children}
    </Comp>
  )
}
