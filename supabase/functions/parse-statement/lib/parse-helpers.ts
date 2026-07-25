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

/** Same date formats as parseStatementDate, but matched at the START of a
 *  longer line (not requiring the whole line to be just a date) — used to
 *  detect where a new transaction begins in PDF text where the description
 *  wraps across multiple lines, so the date, amount, and balance can end up
 *  on different lines than where the transaction started. */
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

/** Matches a currency amount like "₹12.25", "-₹1,64,246.04", "₹3,000" — the
 *  format this statement style uses instead of a trailing CR/DR suffix. */
export const AMOUNT_TOKEN_RE = /-?₹\s?[\d,]+(?:\.\d+)?/g

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
