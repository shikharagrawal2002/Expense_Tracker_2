import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

export function Skeleton({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-lg surface-2', className)}
      {...props}
    />
  )
}

export function Badge({
  className,
  variant = 'default',
  ...props
}: HTMLAttributes<HTMLSpanElement> & { variant?: 'default' | 'positive' | 'negative' | 'warning' }) {
  const variants = {
    default: 'bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-500)]/15 dark:text-[var(--color-brand-300)]',
    positive: 'bg-[var(--color-positive-500)]/15 text-[var(--color-positive-600)]',
    negative: 'bg-[var(--color-negative-500)]/15 text-[var(--color-negative-600)]',
    warning: 'bg-[var(--color-warning-500)]/15 text-[var(--color-warning-500)]',
  }
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        variants[variant],
        className,
      )}
      {...props}
    />
  )
}
