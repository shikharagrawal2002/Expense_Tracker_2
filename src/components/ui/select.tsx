import { type SelectHTMLAttributes, forwardRef } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select
        ref={ref}
        className={cn(
          'w-full h-10 rounded-lg surface-2 border border-hairline px-3 pr-8 text-sm appearance-none',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]',
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
    </div>
  ),
)
Select.displayName = 'Select'
