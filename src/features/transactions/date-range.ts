export type DateRangePreset = 'all' | 'this-month' | 'cycle' | 'custom'

function toIsoDate(d: Date): string {
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/** Calendar month containing `reference`, as [first day, last day]. */
export function getCalendarMonthRange(reference: Date): {
  start: string
  end: string
  label: string
} {
  const year = reference.getFullYear()
  const month = reference.getMonth()

  const start = new Date(year, month, 1)
  const end = new Date(year, month + 1, 0)

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    label: start.toLocaleDateString('en-IN', {
      month: 'long',
      year: 'numeric',
    }),
  }
}

/**
 * Returns the nth working day from the end of a month.
 * n = 1 -> last working day
 * n = 2 -> second-last working day
 */
function nthWorkdayFromEnd(year: number, month: number, n: number): Date {
  // Last calendar day of the month
  const date = new Date(year, month + 1, 0)

  let count = 0

  while (true) {
    const day = date.getDay()

    // Monday-Friday
    if (day !== 0 && day !== 6) {
      count++

      if (count === n) {
        return new Date(date)
      }
    }

    date.setDate(date.getDate() - 1)
  }
}

/**
 * Statement Cycle
 * Start = Last working day of previous month
 * End   = Second-last working day of current month
 */
export function getStatementCycleRange(reference: Date): {
  start: string
  end: string
  label: string
} {
  const year = reference.getFullYear()
  const month = reference.getMonth()

  // Handle January correctly by letting JS normalize month = -1
  const start = nthWorkdayFromEnd(year, month - 1, 1)
  const end = nthWorkdayFromEnd(year, month, 2)

  return {
    start: toIsoDate(start),
    end: toIsoDate(end),
    label: `${start.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })} – ${end.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
  }
}

/**
 * Moves the reference date one calendar month
 * Used for Previous/Next Cycle navigation.
 */
export function shiftMonth(reference: Date, direction: 1 | -1): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth() + direction,
    1
  )
}
