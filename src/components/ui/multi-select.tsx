import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MultiSelectOption {
  value: string
  label: string
}

interface MultiSelectProps {
  options: MultiSelectOption[]
  selected: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  className?: string
}

/** A dropdown that lets you pick zero, one, or many options via checkboxes.
 *  The trigger shows a count of selected items (or the placeholder when none
 *  are selected), and the panel lists every option with a checkbox. */
export function MultiSelect({
  options,
  selected,
  onChange,
  placeholder = 'Select…',
  className,
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Close when clicking outside the component.
  useEffect(() => {
    if (!open) return
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggle(value: string) {
    onChange(selected.includes(value) ? selected.filter((v) => v !== value) : [...selected, value])
  }

  function clearAll() {
    onChange([])
  }

  return (
    <div ref={containerRef} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full h-10 rounded-lg surface-2 border border-hairline px-3 pr-8 text-sm text-left',
          'focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]',
          'flex items-center justify-between gap-2',
        )}
      >
        <span className={cn('truncate', selected.length === 0 && 'text-muted')}>
          {selected.length === 0
            ? placeholder
            : selected.length === 1
              ? options.find((o) => o.value === selected[0])?.label ?? '1 selected'
              : `${selected.length} accounts selected`}
        </span>
        <ChevronDown className="h-4 w-4 text-muted shrink-0" />
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full surface border border-hairline rounded-lg shadow-xl p-1.5 max-h-64 overflow-y-auto">
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearAll}
              className="w-full flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted hover:surface-2 transition-colors"
            >
              <X className="h-3 w-3" />
              Clear selection
            </button>
          )}
          {options.map((option) => {
            const isChecked = selected.includes(option.value)
            return (
              <label
                key={option.value}
                className="flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm cursor-pointer hover:surface-2 transition-colors"
              >
                <span
                  className={cn(
                    'h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                    isChecked
                      ? 'bg-[var(--color-brand-500)] border-[var(--color-brand-500)]'
                      : 'border-hairline',
                  )}
                >
                  {isChecked && <Check className="h-3 w-3 text-white" />}
                </span>
                <input
                  type="checkbox"
                  className="sr-only"
                  checked={isChecked}
                  onChange={() => toggle(option.value)}
                />
                <span className="truncate">{option.label}</span>
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}