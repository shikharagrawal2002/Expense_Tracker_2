import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** Adds hover lift + stronger shadow; use for cards that navigate or open something. */
  interactive?: boolean
}

export function Card({ className, interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'surface border border-hairline rounded-2xl shadow-card',
        interactive && 'lift hover:shadow-card-hover cursor-pointer',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center justify-between px-5 pt-5', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn('font-display text-sm font-medium text-muted tracking-wide', className)}
      {...props}
    />
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col justify-between px-5 pb-5 pt-3', className)} {...props} />
}
