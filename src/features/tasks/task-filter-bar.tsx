import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { DATE_PRESET_LABEL, type TaskDatePreset } from '@/features/tasks/task-dates'
import type { TaskStatusFilter } from '@/features/tasks/api'
import type { TaskPriority } from '@/lib/supabase/types'

const STATUS_OPTIONS: Array<{ value: TaskStatusFilter; label: string }> = [
  { value: 'pending', label: 'Pending' },
  { value: 'done', label: 'Done' },
  { value: 'all', label: 'All' },
]

const DATE_PRESETS: TaskDatePreset[] = ['all', 'overdue', 'today', 'next7', 'none', 'custom']

interface TaskFilterBarProps {
  status: TaskStatusFilter
  onStatusChange: (value: TaskStatusFilter) => void
  priority: TaskPriority | 'all'
  onPriorityChange: (value: TaskPriority | 'all') => void
  datePreset: TaskDatePreset
  onDatePresetChange: (value: TaskDatePreset) => void
  customFrom: string
  onCustomFromChange: (value: string) => void
  customTo: string
  onCustomToChange: (value: string) => void
  search: string
  onSearchChange: (value: string) => void
  hasActiveFilters: boolean
  onClear: () => void
}

/** Status segmented control + priority / date selects + search box. */
export function TaskFilterBar({
  status,
  onStatusChange,
  priority,
  onPriorityChange,
  datePreset,
  onDatePresetChange,
  customFrom,
  onCustomFromChange,
  customTo,
  onCustomToChange,
  search,
  onSearchChange,
  hasActiveFilters,
  onClear,
}: TaskFilterBarProps) {
  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center gap-2">
        {/* Status: a segmented control, since All/Pending/Done is the filter
            people flip most and a dropdown would hide the current value. */}
        <div className="inline-flex rounded-lg surface-2 border border-hairline p-0.5" role="group" aria-label="Filter by status">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onStatusChange(opt.value)}
              aria-pressed={status === opt.value}
              className={cn(
                'rounded-[6px] px-3 py-1.5 text-xs font-medium transition-all',
                status === opt.value
                  ? 'surface text-inherit shadow-sm'
                  : 'text-muted hover:text-inherit',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="w-[140px] shrink-0">
          <Select
            aria-label="Filter by priority"
            value={priority}
            onChange={(e) => onPriorityChange(e.target.value as TaskPriority | 'all')}
            className="h-9 text-xs"
          >
            <option value="all">Any priority</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </Select>
        </div>

        <div className="w-[150px] shrink-0">
          <Select
            aria-label="Filter by date"
            value={datePreset}
            onChange={(e) => onDatePresetChange(e.target.value as TaskDatePreset)}
            className="h-9 text-xs"
          >
            {DATE_PRESETS.map((preset) => (
              <option key={preset} value={preset}>
                {DATE_PRESET_LABEL[preset]}
              </option>
            ))}
          </Select>
        </div>

        <div className="relative min-w-[190px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="h-9 pl-8 text-sm"
          />
        </div>
      </div>

      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="w-[150px]">
            <Input
              type="date"
              aria-label="Due from"
              value={customFrom}
              onChange={(e) => onCustomFromChange(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <span className="text-xs text-muted">to</span>
          <div className="w-[150px]">
            <Input
              type="date"
              aria-label="Due to"
              value={customTo}
              onChange={(e) => onCustomToChange(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
        </div>
      )}

      {hasActiveFilters && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={onClear}>
            <X className="h-3.5 w-3.5" />
            Clear filters
          </Button>
        </div>
      )}
    </div>
  )
}
