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

/** Returns true if Monday-Friday */
function isWorkday(date: Date): boolean {
  const day = date.getDay()
  return day !== 0 && day !== 6
}

/**
 * Returns the nth working day from the end of a month.
 *
 * n = 1 -> Last working day
 * n = 2 -> Second-last working day
 */
function nthWorkdayFromEnd(
  year: number,
  month: number,
  n: number
): Date {
  // JS automatically handles month = -1 or 12
  const date = new Date(year, month + 1, 0)

  let count = 0

  while (true) {
    if (isWorkday(date)) {
      count++

      if (count === n) {
        return new Date(date)
      }
    }

    date.setDate(date.getDate() - 1)
  }
}

/**
 * Returns the next working day after the supplied date.
 */
function nextWorkday(date: Date): Date {
  const result = new Date(date)

  do {
    result.setDate(result.getDate() + 1)
  } while (!isWorkday(result))

  return result
}

/**
 * Statement Cycle
 *
 * End   = Second-last working day of current month
 * Start = Next working day after previous month's end
 *
 * Example:
 * Apr: 30 Mar – 29 Apr
 * May: 30 Apr – 28 May
 * Jun: 29 May – 29 Jun
 * Jul: 30 Jun – 30 Jul
 */
export function getStatementCycleRange(reference: Date): {
  start: string
  end: string
  label: string
} {
  const year = reference.getFullYear()
  const month = reference.getMonth()

  const previousCycleEnd = nthWorkdayFromEnd(year, month - 1, 2)
  const currentCycleEnd = nthWorkdayFromEnd(year, month, 2)

  const start = nextWorkday(previousCycleEnd)

  // 👇 Add this
  console.log({
    reference: reference.toDateString(),
    previousCycleEnd: previousCycleEnd.toDateString(),
    start: start.toDateString(),
    currentCycleEnd: currentCycleEnd.toDateString(),
  })

  return {
    start: toIsoDate(start),
    end: toIsoDate(currentCycleEnd),
    label: `${start.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
    })} – ${currentCycleEnd.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    })}`,
  }
}

/**
 * Previous / Next cycle navigation
 */
export function shiftMonth(
  reference: Date,
  direction: 1 | -1
): Date {
  return new Date(
    reference.getFullYear(),
    reference.getMonth() + direction,
    1
  )
}
