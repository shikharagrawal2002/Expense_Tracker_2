import { type ButtonHTMLAttributes, forwardRef } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-brand-500)] focus-visible:ring-offset-2 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default: 'bg-[var(--color-brand-600)] text-white shadow-sm shadow-[var(--color-brand-600)]/20 hover:bg-[var(--color-brand-700)]',
        secondary:
          'surface-2 border border-hairline text-inherit hover:bg-[var(--color-border-light)] dark:hover:bg-[var(--color-border-dark)]',
        ghost: 'text-muted hover:surface-2 hover:text-inherit',
        destructive: 'bg-[var(--color-negative-600)] text-white hover:opacity-90',
        outline: 'border border-hairline bg-transparent hover:surface-2',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        default: 'h-9 px-4',
        lg: 'h-11 px-6 text-base',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
)
Button.displayName = 'Button'
