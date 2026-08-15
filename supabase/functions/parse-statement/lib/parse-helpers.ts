const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** Parses the handful of date formats Indian bank/card statements actually use
 *  (DD/MM/YYYY, DD-MM-YYYY, DD-Mon-YYYY, DD Mon YYYY, YYYY-MM-DD) into ISO yyyy-mm-dd.
 *  Returns null rather than throwing, so callers can just skip unparsable lines. */
export function parseStatementDate(raw: string): string | null {
  const value = raw.trim().replace(/['â€™]/g, '')
  if (!value) return null

  // yyyy-mm-dd already
  let m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`

  // dd/mm/yyyy or dd-mm-yyyy or dd.mm.yyyy (also accepts 2-digit year)
  m = value.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/)
  if (m) {
    let year = m[3]
    if (year.length === 2) year = Number(year) > 50 ? `19${year}` : `20${year}`
    return `${year}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`
  }

  // dd-Mon-yyyy / dd Mon yyyy / dd-Mon-yy / dd-Mon'yy (the apostrophe-year style
  // Indian statements commonly use, e.g. "02-Jul'25")
  m = value.match(/^(\d{1,2})[\s\-](\w{3,})[\s\-,']+(\d{2,4})$/)
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (!mon) return null
    let year = m[3]
    if (year.length === 2) year = `20${year}`
    return `${year}-${mon}-${m[1].padStart(2, '0')}`
  }

  // ddMonyyyy with NO separators at all, e.g. "14Jun2026" (seen in HSBC exports)
  m = value.match(/^(\d{1,2})([A-Za-z]{3})(\d{4})$/)
  if (m) {
    const mon = MONTHS[m[2].toLowerCase()]
    if (!mon) return null
    return `${m[3]}-${mon}-${m[1].padStart(2, '0')}`
  }

  return null
}

const LEADING_DATE_PATTERNS = [
  /^(\d{4}-\d{1,2}-\d{1,2})\b/,
  /^(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
  /^(\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,']+\d{2,4})\b/,
  /^(\d{1,2}[A-Za-z]{3}\d{4})\b/,
]

export function extractLeadingDate(line: string): { date: string; rest: string } | null {
  for (const pattern of LEADING_DATE_PATTERNS) {
    const m = line.match(pattern)
    if (!m) continue
    const iso = parseStatementDate(m[1])
    if (iso) return { date: iso, rest: line.slice(m[0].length).trim() }
  }
  return null
}

/** Same date shapes as LEADING_DATE_PATTERNS, but scanning for every
 *  occurrence ANYWHERE in a string rather than only at its very start.
 *  Needed because unpdf's real extracted text does NOT reliably insert line
 *  breaks between transaction rows — a whole multi-page statement can come
 *  back as one continuous line — so "date at the start of a line" is not a
 *  safe assumption. The negative lookbehind keeps this from matching in the
 *  middle of a longer digit run (e.g. inside a 20-digit reference number),
 *  and the negative lookahead for a digit (rather than \b) means a date
 *  immediately glued to following text with no space — "09/08/2026Registered" —
 *  still matches correctly (digit→letter isn't a word-boundary in regex terms). */
const GLOBAL_DATE_PATTERNS = [
  /(?<![\w/.-])(\d{4}-\d{1,2}-\d{1,2})(?!\d)/g,
  /(?<![\w/.-])(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})(?!\d)/g,
  /(?<![\w/.-])(\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,']+\d{2,4})(?!\d)/g,
  /(?<![\w/.-])(\d{1,2}[A-Za-z]{3}\d{4})(?!\d)/g,
]

export interface DateOccurrence {
  index: number
  date: string
  matchLength: number
}

/** Finds every date-shaped occurrence in a continuous string, in order of
 *  position. Where two of the pattern variants both match at the same spot,
 *  the earlier-listed pattern wins and the overlap is skipped. */
export function findAllDateOccurrences(text: string): DateOccurrence[] {
  const found: DateOccurrence[] = []
  for (const pattern of GLOBAL_DATE_PATTERNS) {
    for (const m of text.matchAll(pattern)) {
      if (m.index === undefined) continue
      const iso = parseStatementDate(m[1])
      if (iso) found.push({ index: m.index, date: iso, matchLength: m[0].length })
    }
  }
  found.sort((a, b) => a.index - b.index)

  const deduped: DateOccurrence[] = []
  let lastEnd = -1
  for (const occurrence of found) {
    if (occurrence.index >= lastEnd) {
      deduped.push(occurrence)
      lastEnd = occurrence.index + occurrence.matchLength
    }
  }
  return deduped
}

/** Source (no anchors) for a properly Indian-grouped number: either
 *  comma-grouped with the rightmost group having exactly 3 digits (e.g.
 *  "1,64,246", "13,661"), or a plain ungrouped run of up to 7 digits.
 *  Deliberately does NOT match an arbitrary run of digits+commas — some PDFs'
 *  text extraction fuses two adjacent table cells with no separator at all
 *  (e.g. a date immediately followed by an amount, "13/07/202613,661.00"), and
 *  a loose "[\d,]+" pattern will happily swallow both into one number.
 *  Requiring valid grouping forces the match to start at the real number
 *  instead — confirmed against a real statement where this fusion occurred. */
export const INDIAN_NUMBER_SOURCE = String.raw`(?:\d{1,2}(?:,\d{2})*,\d{3}|\d{1,7})`

/** Same, but requiring a decimal point + exactly 2 digits — the shape every
 *  statement we've parsed actually uses for amounts (paise are always shown,
 *  even for round numbers). */
export const INDIAN_DECIMAL_SOURCE = `${INDIAN_NUMBER_SOURCE}\\.\\d{2}`

/** Matches a currency amount like "₹12.25", "-₹1,64,246.04", "₹3,000" — the
 *  format this statement style uses instead of a trailing CR/DR suffix. */
export const AMOUNT_TOKEN_RE = new RegExp(String.raw`-?₹\s?${INDIAN_NUMBER_SOURCE}(?:\.\d+)?`, 'g')

/** Parses amount strings like "1,234.50", "₹1,234.50", "(1,234.50)" (accounting
 *  negative), "1234.50 CR" into a plain number. Returns null if nothing numeric found. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!value) return null
  const isParenNegative = /^\(.*\)$/.test(value)
  const cleaned = value.replace(/[₹$,\s()]/g, '').replace(/(CR|DR|Cr|Dr)$/i, '')
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const num = Number(cleaned)
  if (Number.isNaN(num)) return null
  return isParenNegative ? -Math.abs(num) : num
}

/** CR/DR (or explicit +/-) suffix/prefix detection, used when a statement has a
 *  single "amount" column instead of separate debit/credit columns. */
export function detectDirectionFromText(raw: string): 'debit' | 'credit' | null {
  if (/\bcr\b/i.test(raw)) return 'credit'
  if (/\bdr\b/i.test(raw)) return 'debit'
  if (/^\(.*\)$/.test(raw.trim())) return 'credit' // parens often denote a credit/refund
  return null
}

/** Very small keyword → category map, seeded from common Indian-statement
 *  merchant/narration patterns. This only produces a *suggestion* shown in the
 *  review table — it never bypasses the user's own automation_rules/category
 *  edit in the UI. */
const CATEGORY_KEYWORDS: Array<[RegExp, string]> = [
  [/swiggy|zomato|eatsure|food/i, 'Food'],
  [/uber|ola|rapido|irctc|indigo|flight|travel/i, 'Travel'],
  [/amazon|flipkart|myntra/i, 'Shopping'],
  [/netflix|prime video|hotstar|spotify|youtube/i, 'Entertainment'],
  [/electricity|water bill|gas bill|broadband|wifi|internet/i, 'Utilities'],
  [/rent\b/i, 'Rent'],
  [/emi\b|loan/i, 'Loan EMI'],
  [/salary|payroll/i, 'Salary'],
  [/mutual fund|sip\b|zerodha|groww|nps\b/i, 'Investment'],
  [/insurance/i, 'Insurance'],
]

export function suggestCategory(description: string): string | undefined {
  for (const [pattern, category] of CATEGORY_KEYWORDS) {
    if (pattern.test(description)) return category
  }
  return undefined
}
