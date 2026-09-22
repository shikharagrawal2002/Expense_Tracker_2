import { AlertTriangle, CalendarClock, CalendarDays, ListTodo } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import type { TaskStats } from '@/features/tasks/api'

export type StatKey = 'pending' | 'overdue' | 'today' | 'week'

interface TaskSummaryProps {
  stats?: TaskStats
  isLoading: boolean
  /** Drives the highlighted tile, so the strip doubles as a filter shortcut. */
  activeStat?: StatKey
  onSelectStat: (key: StatKey) => void
}

/** Progress bar + four clickable counters. Tapping a counter applies the matching
 *  filter below, which is the fastest way to get to "what's overdue?". */
export function TaskSummary({ stats, isLoading, activeStat, onSelectStat }: TaskSummaryProps) {
  if (isLoading || !stats) {
    return (
      <Card className="p-4 sm:p-5">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="mt-3 h-2 w-full rounded-full" />
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[62px] rounded-xl" />
          ))}
        </div>
      </Card>
    )
  }

  const tiles: Array<{ key: StatKey; label: string; value: number; icon: typeof ListTodo; tone: string }> = [
    { key: 'pending', label: 'Pending', value: stats.pending, icon: ListTodo, tone: 'text-inherit' },
    {
      key: 'overdue',
      label: 'Overdue',
      value: stats.overdue,
      icon: AlertTriangle,
      tone: 'text-[var(--color-negative-600)]',
    },
    {
      key: 'today',
      label: 'Due today',
      value: stats.dueToday,
      icon: CalendarClock,
      tone: 'text-[var(--color-warning-500)]',
    },
    {
      key: 'week',
      label: 'Next 7 days',
      value: stats.dueThisWeek,
      icon: CalendarDays,
      tone: 'text-[var(--color-brand-500)]',
    },
  ]

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-muted">Progress</p>
          <p className="mt-0.5 font-display text-lg font-semibold num">
            {stats.done} of {stats.total} done
          </p>
        </div>
        <p className="num text-2xl font-semibold text-[var(--color-brand-500)]">{stats.completionPct}%</p>
      </div>

      <div className="mt-3 h-2 w-full overflow-hidden rounded-full surface-2">
        <div
          className="h-full rounded-full bg-[var(--color-positive-500)] transition-all duration-500"
          style={{ width: `${stats.completionPct}%` }}
          role="progressbar"
          aria-valuenow={stats.completionPct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Tasks completed"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((tile) => (
          <button
            key={tile.key}
            type="button"
            onClick={() => onSelectStat(tile.key)}
            aria-pressed={activeStat === tile.key}
            className={cn(
              'rounded-xl border px-3 py-2.5 text-left transition-colors',
              activeStat === tile.key
                ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/15'
                : 'border-hairline hover:surface-2',
            )}
          >
            <span className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
              <tile.icon className={cn('h-3.5 w-3.5', tile.value > 0 ? tile.tone : '')} />
              {tile.label}
            </span>
            <span className={cn('mt-0.5 block font-display text-lg font-semibold num', tile.value > 0 ? tile.tone : 'text-muted')}>
              {tile.value}
            </span>
          </button>
        ))}
      </div>
    </Card>
  )
}
