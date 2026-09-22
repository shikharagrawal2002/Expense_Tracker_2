import { type InputHTMLAttributes, type TextareaHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full h-10 rounded-md surface-2 border border-hairline px-3 text-sm transition-shadow',
        'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]/25 focus:border-[var(--color-brand-500)]',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea
      ref={ref}
      className={cn(
        'w-full min-h-[80px] resize-y rounded-md surface-2 border border-hairline px-3 py-2 text-sm transition-shadow',
        'placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]/25 focus:border-[var(--color-brand-500)]',
        'disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
)
Textarea.displayName = 'Textarea'

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn('text-sm font-medium mb-1.5 block', className)} {...props} />
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null
  return <p className="text-xs text-[var(--color-negative-600)] mt-1">{message}</p>
}
