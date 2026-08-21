const MONTHS: Record<string, string> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12',
}

/** Parses the handful of date formats Indian statements use into ISO yyyy-mm-dd. */
export function parseStatementDate(raw: string): string | null {
  const value = raw.trim()
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

  // dd-Mon-yyyy / dd Mon yyyy / dd-Mon-yy
  m = value.match(/^(\d{1,2})[\s\-](\w{3,})[\s\-,']+(\d{2,4})$/)
  if (m) {
    const mon = MONTHS[m[2].slice(0, 3).toLowerCase()]
    if (!mon) return null
    let year = m[3]
    if (year.length === 2) year = `20${year}`
    return `${year}-${mon}-${m[1].padStart(2, '0')}`
  }

  return null
}

/** Parses amount strings like "1,234.50", "₹1,234.50", "(1,234.50)", "1234.50" into a plain number. */
export function parseAmount(raw: string): number | null {
  if (raw == null) return null
  const value = String(raw).trim()
  if (!value) return null
  const isParenNegative = /^\(.*\)$/.test(value)
  const cleaned = value.replace(/[₹$,\s()]/g, '').replace(/(CR|DR|Cr|Dr|Dr\.|Cr\.)$/i, '')
  if (!cleaned || !/^-?\d+(\.\d+)?$/.test(cleaned)) return null
  const num = Number(cleaned)
  if (Number.isNaN(num)) return null
  return isParenNegative ? -Math.abs(num) : num
}