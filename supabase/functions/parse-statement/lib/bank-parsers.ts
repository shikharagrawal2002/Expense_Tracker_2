import type { ExtractedContent, ParsedTransaction } from './types.ts'
import { parseAmount, parseStatementDate, detectDirectionFromText, suggestCategory } from './parse-helpers.ts'

const HEADER_KEYWORDS = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date'],
  description: ['narration', 'description', 'particulars', 'details', 'remarks', 'transaction remarks'],
  debit: ['debit', 'withdrawal', 'withdrawal amt', 'dr', 'debit amount'],
  credit: ['credit', 'deposit', 'deposit amt', 'cr', 'credit amount'],
  amount: ['amount', 'txn amount', 'transaction amount'],
  balance: ['balance', 'closing balance', 'running balance', 'available balance'],
}

function findColumn(headerRow: string[], keywords: string[]): number {
  const normalized = headerRow.map((h) => (h || '').toLowerCase().trim())
  for (const keyword of keywords) {
    const idx = normalized.findIndex((h) => h === keyword)
    if (idx !== -1) return idx
  }
  for (const keyword of keywords) {
    const idx = normalized.findIndex((h) => h.includes(keyword))
    if (idx !== -1) return idx
  }
  return -1
}

function locateHeaderRow(rows: string[][]): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i]
    const hasDate = findColumn(row, HEADER_KEYWORDS.date) !== -1
    const hasAmountish =
      findColumn(row, HEADER_KEYWORDS.amount) !== -1 ||
      findColumn(row, HEADER_KEYWORDS.debit) !== -1 ||
      findColumn(row, HEADER_KEYWORDS.credit) !== -1
    if (hasDate && hasAmountish) return i
  }
  return -1
}

function parseTable(rows: string[][], warnings: string[]): ParsedTransaction[] {
  const headerIdx = locateHeaderRow(rows)
  if (headerIdx === -1) {
    warnings.push(
      'Could not find a header row with recognizable Date/Amount columns — no transactions were extracted from the table. Try exporting a plain CSV from your bank\'s "download statement" option.',
    )
    return []
  }

  const header = rows[headerIdx]
  const col = {
    date: findColumn(header, HEADER_KEYWORDS.date),
    description: findColumn(header, HEADER_KEYWORDS.description),
    debit: findColumn(header, HEADER_KEYWORDS.debit),
    credit: findColumn(header, HEADER_KEYWORDS.credit),
    amount: findColumn(header, HEADER_KEYWORDS.amount),
    balance: findColumn(header, HEADER_KEYWORDS.balance),
  }

  const out: ParsedTransaction[] = []
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i]
    if (!row || row.every((cell) => !cell || !String(cell).trim())) continue

    const date = col.date !== -1 ? parseStatementDate(String(row[col.date] ?? '')) : null
    if (!date) continue

    const description = col.description !== -1 ? String(row[col.description] ?? '').trim() : ''

    let amount: number | null = null
    let direction: 'debit' | 'credit' | null = null

    if (col.debit !== -1 || col.credit !== -1) {
      const debitVal = col.debit !== -1 ? parseAmount(String(row[col.debit] ?? '')) : null
      const creditVal = col.credit !== -1 ? parseAmount(String(row[col.credit] ?? '')) : null
      if (debitVal) {
        amount = Math.abs(debitVal)
        direction = 'debit'
      } else if (creditVal) {
        amount = Math.abs(creditVal)
        direction = 'credit'
      }
    } else if (col.amount !== -1) {
      const raw = String(row[col.amount] ?? '')
      const parsed = parseAmount(raw)
      if (parsed !== null) {
        amount = Math.abs(parsed)
        direction = detectDirectionFromText(raw) ?? (parsed < 0 ? 'debit' : 'credit')
      }
    }

    if (amount === null || direction === null || amount === 0) continue

    const balanceRaw = col.balance !== -1 ? parseAmount(String(row[col.balance] ?? '')) : null

    out.push({
      date,
      description: description || '(no description)',
      amount,
      direction,
      isDuplicate: false,
      balanceAfter: balanceRaw ?? undefined,
      suggestedCategory: suggestCategory(description),
      sourceLine: row.join(' | '),
    })
  }
  return out
}

// Matches lines like: "12/07/2025  AMAZON PAY INDIA  1,234.50 DR  45,000.00"
// or "12-Jul-25  UPI-SWIGGY  250.00  Cr" — the three or four token shape common
// to Indian PDF bank/card statements exported to plain text.
const PDF_LINE_PATTERN =
  /^(\d{1,2}[\/\-][A-Za-z]{3,}[\/\-]?\d{0,4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s+(.+?)\s+([\d,]+\.\d{2})\s*(CR|DR|Cr|Dr)?(?:\s+([\d,]+\.\d{2}))?$/

function parseTextLines(lines: string[], warnings: string[]): ParsedTransaction[] {
  const out: ParsedTransaction[] = []
  for (const line of lines) {
    const match = line.match(PDF_LINE_PATTERN)
    if (!match) continue
    const date = parseStatementDate(match[1])
    const amount = parseAmount(match[3])
    if (!date || amount === null || amount === 0) continue

    const direction: 'debit' | 'credit' =
      (match[4]?.toLowerCase() === 'cr' ? 'credit' : match[4]?.toLowerCase() === 'dr' ? 'debit' : null) ??
      'debit' // most statement lines are spends; explicit CR overrides this above

    const description = match[2].trim()
    out.push({
      date,
      description,
      amount: Math.abs(amount),
      direction,
      isDuplicate: false,
      balanceAfter: match[5] ? parseAmount(match[5]) ?? undefined : undefined,
      suggestedCategory: suggestCategory(description),
      sourceLine: line,
    })
  }
  if (out.length === 0) {
    warnings.push(
      'No transaction-shaped lines were found in the PDF text. Scanned/image-only PDFs need OCR, which this parser does not do yet — try a text-based PDF export or a CSV/Excel download instead.',
    )
  }
  return out
}

export function parseBankStatement(content: ExtractedContent, warnings: string[]): ParsedTransaction[] {
  return content.format === 'table' ? parseTable(content.rows, warnings) : parseTextLines(content.lines, warnings)
}
