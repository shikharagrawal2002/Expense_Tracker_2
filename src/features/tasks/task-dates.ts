/** Date helpers for the task tracker.
 *
 *  Everything here works in the *local* calendar day, because a due date is a
 *  day ("by Friday"), not an instant. Using `toISOString()` would shift the day
 *  for users east of UTC (IST is UTC+5:30), which is why the ISO helpers below
 *  build the string from the local year/month/day parts instead. */

/** Local calendar day as 'YYYY-MM-DD' (the format the `due_date` column uses). */
export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayKey(): string {
  return toDateKey(new Date())
}

/** Parses a 'YYYY-MM-DD' key back into a local-midnight Date. */
export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, (month ?? 1) - 1, day ?? 1)
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

/** Whole days from today to `dateKey`: negative = overdue, 0 = due today. */
export function daysUntil(dateKey: string): number {
  const target = fromDateKey(dateKey)
  const today = new Date()
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())
  return Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000)
}

/** True for pending tasks whose due date has already passed. */
export function isOverdue(dateKey: string | null, isDone: boolean): boolean {
  return !isDone && Boolean(dateKey) && daysUntil(dateKey as string) < 0
}

/** True for pending tasks due today (and not already overdue). */
export function isDueToday(dateKey: string | null, isDone: boolean): boolean {
  return !isDone && Boolean(dateKey) && daysUntil(dateKey as string) === 0
}

/** "Today", "Tomorrow", "Yesterday", "in 4 days", "3 days ago", else the date. */
export function formatDueDate(dateKey: string): string {
  const days = daysUntil(dateKey)
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days === -1) return 'Yesterday'
  // Covers the whole "Next 7 days" bucket, so no row in that section ever
  // falls back to a bare date.
  if (days > 1 && days <= 7) return `in ${days} days`
  if (days < -1 && days >= -6) return `${Math.abs(days)} days ago`
  const date = fromDateKey(dateKey)
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  })
}

export function formatFullDate(dateKey: string): string {
  return fromDateKey(dateKey).toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

/** Which bucket a task belongs to in the grouped list. */
export type DueBucket = 'overdue' | 'today' | 'tomorrow' | 'week' | 'later' | 'none' | 'done'

export function dueBucket(dueDate: string | null, isDone: boolean): DueBucket {
  if (isDone) return 'done'
  if (!dueDate) return 'none'
  const days = daysUntil(dueDate)
  if (days < 0) return 'overdue'
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  if (days <= 7) return 'week'
  return 'later'
}

export const DUE_BUCKET_LABEL: Record<DueBucket, string> = {
  overdue: 'Overdue',
  today: 'Today',
  tomorrow: 'Tomorrow',
  week: 'Next 7 days',
  later: 'Later',
  none: 'No due date',
  done: 'Completed',
}

/** Display order for the grouped sections shown on the Tasks page. */
export const DUE_BUCKET_ORDER: DueBucket[] = [
  'overdue',
  'today',
  'tomorrow',
  'week',
  'later',
  'none',
  'done',
]

// ---------------------------------------------------------------------------
// Date filter presets
// ---------------------------------------------------------------------------

export type TaskDatePreset = 'all' | 'overdue' | 'today' | 'next7' | 'none' | 'custom'

export const DATE_PRESET_LABEL: Record<TaskDatePreset, string> = {
  all: 'Any date',
  overdue: 'Overdue',
  today: 'Due today',
  next7: 'Next 7 days',
  none: 'No due date',
  custom: 'Custom range',
}

export interface ResolvedDateFilter {
  dateFrom?: string
  dateTo?: string
  /** Set to false by the "No due date" preset. */
  hasDueDate?: boolean
}

/** Turns the preset (plus the custom range inputs) into the bounds the query
 *  layer applies to `due_date`. Comparing as 'YYYY-MM-DD' strings works because
 *  that format sorts chronologically. */
export function resolveDatePreset(
  preset: TaskDatePreset,
  customFrom: string,
  customTo: string,
): ResolvedDateFilter {
  switch (preset) {
    case 'overdue':
      // Anything strictly before today and already due.
      return { dateTo: toDateKey(addDays(new Date(), -1)) }
    case 'today':
      return { dateFrom: todayKey(), dateTo: todayKey() }
    case 'next7':
      return { dateFrom: todayKey(), dateTo: toDateKey(addDays(new Date(), 7)) }
    case 'none':
      return { hasDueDate: false }
    case 'custom':
      // Both bounds optional — a from-only or to-only range is valid.
      return { dateFrom: customFrom || undefined, dateTo: customTo || undefined }
    case 'all':
    default:
      return {}
  }
}
