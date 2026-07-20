export type DateRangePreset = 'all' | 'this-month' | 'cycle' | 'custom'

function toIsoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Calendar month containing `reference`, as [first day, last day]. */
export function getCalendarMonthRange(reference: Date): { start: string; end: string; label: string } {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    label: start.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }),
  }
}

/** The "billing cycle" style month: from the last day of the previous month
 *  to the second-last day of the current month (e.g. for July: 30 Jun – 30 Jul).
 *  `reference` just needs to fall somewhere in the target "current month". */
export function getStatementCycleRange(reference: Date): { start: string; end: string; label: string } {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const start = new Date(year, month, 0) // day 0 => last day of previous month
  const end = new Date(year, month + 1, -1) // day -1 of next month => second-last day of this month
  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    label: `${start.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`,
  }
}

/** Moves the reference date to the same day-of-month one calendar month
 *  forward/back, for "previous cycle" / "next cycle" navigation. */
export function shiftMonth(reference: Date, direction: 1 | -1): Date {
  return new Date(reference.getFullYear(), reference.getMonth() + direction, 1)
}
