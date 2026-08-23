// Groww export parser.
//
// Handles three report types:
//   1. Holdings report (XLSX/CSV) — current units, average cost, invested, current value
//   2. Transaction report (XLSX/CSV/PDF) — buy/SIP/redemption history
//   3. Capital-gains report (PDF) — parsed like transactions

import { parseStatementDate, parseAmount } from './parse-helpers.ts'
import type { ExtractedContent } from './types.ts'

export interface GrowwHolding {
  schemeName: string
  schemeCode?: string
  isin?: string
  units: number
  averageCost: number
  investedAmount: number
  currentValue: number
}

export interface GrowwTransaction {
  schemeName: string
  schemeCode?: string
  isin?: string
  type: 'buy' | 'sip' | 'redemption' | 'switch_in' | 'switch_out' | 'dividend'
  units: number
  nav: number
  amount: number
  date: string // yyyy-mm-dd
}

/**
 * Parses the Groww Holdings export.
 *
 * Groww Holdings XLSX typically has columns like:
 *   Scheme Name | Invested Value | Current Value | Units | Average Cost | ISIN | Scheme Code
 * or the older format:
 *   Scheme Name | Units | Current NAV | Current Value | Average Cost | Invested Value
 *
 * When ISIN / scheme code aren't present in the export, we match on scheme name.
 */
export function parseGrowwHoldings(content: ExtractedContent): GrowwHolding[] {
  if (content.format === 'text') {
    // PDF holdings — attempt a loose text parse (a columnar line by line).
    const holdings: GrowwHolding[] = []
    for (const line of content.lines) {
      // Look for a working-ish pattern: name + a couple of numbers.
      const m = line.match(/^(.+?)\s+₹?\s*([\d,]+\.?\d*)\s+₹?\s*([\d,]+\.?\d*)/)
      if (m) {
        const schemeName = m[1].trim()
        const currentValue = Number(m[2].replace(/,/g, ''))
        const investedAmount = Number(m[3].replace(/,/g, ''))
        if (schemeName && !Number.isNaN(currentValue) && !Number.isNaN(investedAmount)) {
          holdings.push({
            schemeName,
            units: 0,
            averageCost: 0,
            investedAmount,
            currentValue,
          })
        }
      }
    }
    return holdings
  }

  const holdings: GrowwHolding[] = []
  const rows = content.rows
  if (!rows || rows.length === 0) return holdings

  // Headers: turn every cell into a lowercase key for column matching.
  const headerRow = rows[0].map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, ''))

  const col = (...names: string[]): number => {
    const idx = headerRow.findIndex((h) => names.some((n) => h.includes(n)))
    return idx >= 0 ? idx : -1
  }

  // More robust column matching with many variations
  const nameCol = col('scheme_name', 'scheme', 'fund_name', 'fund', 'mutual_fund', 'name', 'instrument')
  const investedCol = col('invested_value', 'invested_amount', 'invested', 'total_invested', 'amount_invested', 'cost_value')
  const currentCol = col('current_value', 'current', 'market_value', 'value', 'nav_value', 'valuation')
  const unitsCol = col('units', 'quantity', 'qty', 'unit_balance', 'total_units')
  const avgCostCol = col('average_cost', 'avg_cost', 'average_price', 'avg_price', 'plusavg', 'avg', 'cost_per_unit')
  const isinCol = col('isin', 'isin_code', 'isin_number')
  const schemeCodeCol = col('scheme_code', 'amfi_code', 'code', 'scheme_id')

  // If name column not found, try to detect by position (first column is usually the name)
  let effectiveNameCol = nameCol
  if (effectiveNameCol < 0 && headerRow.length > 0) {
    // First column is almost always the scheme name
    effectiveNameCol = 0
  }

  if (effectiveNameCol < 0) return holdings

  for (const row of rows.slice(1)) {
    const schemeName = String(row[effectiveNameCol] ?? '').trim()
    if (!schemeName || schemeName.toLowerCase().includes('total')) continue

    const getNum = (idx: number): number => {
      if (idx < 0) return 0
      const val = parseAmount(String(row[idx] ?? ''))
      return val ?? 0
    }

    // Newer Groww format has invested and current only; older has units + avg cost.
    const investedAmount = getNum(investedCol)
    const currentValue = getNum(currentCol)
    const units = getNum(unitsCol)
    const averageCost = getNum(avgCostCol)

    // If invested/current columns weren't found, try to infer from units × avg cost
    const inferredInvested = units > 0 && averageCost > 0 ? units * averageCost : 0
    const finalInvested = investedAmount > 0 ? investedAmount : inferredInvested

    const holding: GrowwHolding = {
      schemeName,
      schemeCode: schemeCodeCol >= 0 ? String(row[schemeCodeCol] ?? '').trim() || undefined : undefined,
      isin: isinCol >= 0 ? String(row[isinCol] ?? '').trim() || undefined : undefined,
      units,
      averageCost,
      investedAmount: finalInvested,
      currentValue: currentValue > 0 ? currentValue : (units > 0 && averageCost > 0 ? units * averageCost : 0),
    }
    holdings.push(holding)
  }

  return holdings
}

/**
 * Parses the Groww Transaction export.
 * Expected columns (newer format):
 *   Order ID | Date | Scheme Name | Type (Buy/SIP/Redemption) | Amount | Units | NAV | ISIN | ...
 * Older format:
 *   Date | Description/Scheme | Type | Amount | Units | NAV
 * For PDF capital-gains reports, we scan text lines for date + amount + scheme.
 */
export function parseGrowwTransactions(content: ExtractedContent): GrowwTransaction[] {
  if (content.format === 'text') {
    return parseTransactionsFromText(content.lines)
  }

  const transactions: GrowwTransaction[] = []
  const rows = content.rows
  if (!rows || rows.length === 0) return transactions

  const headerRow = rows[0] ?? []
  const headerLower = headerRow.map((c) => c.toLowerCase().replace(/[^a-z0-9]+/g, '_').trim().replace(/^_+|_+$/g, ''))

  const findCol = (names: string[]): number => {
    return headerLower.findIndex((h) => names.some((n) => h.includes(n)))
  }

  const dateCol = findCol(['date', 'trade_date', 'transaction_date', 'order_date'])
  const typeCol = findCol(['type', 'transaction_type', 'order_type', 'transaction'])
  const nameCol = findCol(['scheme_name', 'scheme', 'fund_name', 'fund', 'name', 'description', 'instrument'])
  const amountCol = findCol(['amount', 'net_amount', 'transaction_amount', 'invested_amount'])
  const unitsCol = findCol(['units', 'quantity', 'qty'])
  const navCol = findCol(['nav', 'price', 'rate', 'nav_price'])
  const isinCol = findCol(['isin'])
  const schemeCodeCol = findCol(['scheme_code', 'code', 'amfi_code'])

  if (dateCol < 0 || typeCol < 0 || nameCol < 0) {
    // Try a more lenient row scan: dates + amounts without strong headers.
    return parseTransactionsLoose(rows, headerRow)
  }

  for (const row of rows.slice(1)) {
    const dateRaw = String(row[dateCol] ?? '').trim()
    const date = parseStatementDate(dateRaw)
    if (!date) continue

    const typeRaw = String(row[typeCol] ?? '').toLowerCase()
    let type: GrowwTransaction['type'] = 'buy'
    if (/sip|stp|systematic/i.test(typeRaw)) type = 'sip'
    else if (/redemption|sell|exit/i.test(typeRaw)) type = 'redemption'
    else if (/switch_in/i.test(typeRaw)) type = 'switch_in'
    else if (/switch_out/i.test(typeRaw)) type = 'switch_out'
    else if (/dividend|payout/i.test(typeRaw)) type = 'dividend'

    const schemeName = String(row[nameCol] ?? '').trim()
    if (!schemeName) continue

    const amount = parseAmount(String(row[amountCol] ?? '')) ?? 0
    const units = parseAmount(String(row[unitsCol] ?? '')) ?? 0
    const nav = parseAmount(String(row[navCol] ?? '')) ?? 0
    const isin = isinCol >= 0 ? String(row[isinCol] ?? '').trim() || undefined : undefined
    const schemeCode = schemeCodeCol >= 0 ? String(row[schemeCodeCol] ?? '').trim() || undefined : undefined

    transactions.push({
      schemeName,
      schemeCode,
      isin,
      type,
      date,
      units,
      nav,
      amount: amount || (units * nav) || (type === 'redemption' ? -amount : amount),
    })
  }

  return transactions
}

function parseTransactionsFromText(lines: string[]): GrowwTransaction[] {
  const transactions: GrowwTransaction[] = []
  // Capital-gains text layout is often "date | scheme | units | nav | amount".
  // We look for a date anywhere in the line, then units + rupee amounts.
  for (const line of lines) {
    const dateMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2})/)
    if (!dateMatch) continue
    const date = parseStatementDate(dateMatch[1])
    if (!date) continue

    const amounts = [...line.matchAll(/₹?\s?([\d,]+\.?\d*)/g)].map((m) => Number(m[1].replace(/,/g, '')))
    if (amounts.length < 2) continue

    const unitsMatch = line.match(/([\d,]+\.\d+)\s*(?:units|unit|qty|UT)/i)
    const typeRaw = line.toLowerCase()
    const type: GrowwTransaction['type'] =
      /redemption|sell/i.test(typeRaw) ? 'redemption'
      : /switch_out/i.test(typeRaw) ? 'switch_out'
      : /switch_in/i.test(typeRaw) ? 'switch_in'
      : /dividend/i.test(typeRaw) ? 'dividend'
      : /sip/i.test(typeRaw) ? 'sip'
      : 'buy'

    const schemeName = line.replace(/₹?[\d,]+\.?\d*/g, '').replace(/^\s*[-•|]\s*/, '').trim()

    transactions.push({
      schemeName: schemeName || 'Unknown scheme',
      type,
      date,
      units: unitsMatch ? Number(unitsMatch[1].replace(/,/g, '')) : 0,
      nav: amounts[amounts.length - 2] ?? 0,
      amount: amounts[amounts.length - 1] ?? 0,
    })
  }
  return transactions
}

function parseTransactionsLoose(rows: string[][], headerRow: string[]): GrowwTransaction[] {
  const transactions: GrowwTransaction[] = []
  for (const row of rows.slice(1)) {
    const line = row.join(' ')
    const dateMatch = line.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})/)
    if (!dateMatch) continue
    const date = parseStatementDate(dateMatch[1])
    if (!date) continue

    const amounts = row.map((c) => parseAmount(c) ?? 0)
    const unitsCandidates = amounts.filter((a) => a > 0 && a < 1000)
    const amountCandidates = amounts.filter((a) => a >= 100)

    const schemeName = row.find((c) => /fund|scheme|direct|regular/i.test(c)) ?? 'Unknown'

    const typeRaw = row.join(' ').toLowerCase()
    const type: GrowwTransaction['type'] =
      /redemption|sell/i.test(typeRaw) ? 'redemption'
      : /sip/i.test(typeRaw) ? 'sip'
      : /switch/i.test(typeRaw) ? /out/i.test(typeRaw) ? 'switch_out' : 'switch_in'
      : 'buy'

    transactions.push({
      schemeName: schemeName.replace(/^\s*[-–|]\s*/, '').trim() || 'Unknown',
      type,
      date,
      units: unitsCandidates[0] ?? 0,
      nav: 0,
      amount: amountCandidates[amountCandidates.length - 1] ?? 0,
    })
  }
  return transactions
}