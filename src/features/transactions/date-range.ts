export type DateRangePreset = 'all' | 'this-month' | 'cycle' | 'custom'

function toIsoDate(d: Date): string {
  // Deliberately NOT using d.toISOString().slice(0, 10) — that converts to UTC
  // first, which silently shifts the date back by a day for any timezone
  // ahead of UTC (IST is UTC+5:30), since local midnight becomes the previous
  // day's evening in UTC. Reading the local calendar fields directly avoids that.
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Rolls a date backward (or forward) off a weekend onto the nearest business
 *  day. Defaults to backward, matching the usual "last business day of the
 *  month" banking convention. */
function toWorkday(date: Date, direction: 'backward' | 'forward' = 'backward'): Date {
  const result = new Date(date)
  const step = direction === 'backward' ? -1 : 1
  while (result.getDay() === 0 || result.getDay() === 6) {
    result.setDate(result.getDate() + step)
  }
  return result
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
 *  to the second-last day of the current month (e.g. for July: 30 Jun – 30 Jul),
 *  each rolled back off a weekend onto the nearest business day.
 *  `reference` just needs to fall somewhere in the target "current month". */
export function getStatementCycleRange(reference: Date): { start: string; end: string; label: string } {
  const year = reference.getFullYear()
  const month = reference.getMonth()
  const start = toWorkday(new Date(year, month, 0)) // last day of previous month, workday-adjusted
  const end = toWorkday(new Date(year, month + 1, -1)) // second-last day of this month, workday-adjusted
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
