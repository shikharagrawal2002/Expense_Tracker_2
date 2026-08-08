import { parseAmount, parseStatementDate } from './parse-helpers.ts'
import { parseBankStatement, type BankProvider } from './bank-parsers.ts'

// Inlined rather than imported from ./types.ts — see the note in dedupe.ts
// for why: that file is type-only and some deploy pipelines drop it.
type ExtractedContent =
  | { format: 'table'; rows: string[][] }
  | { format: 'text'; lines: string[] }

interface ParsedTransaction {
  date: string
  description: string
  amount: number
  direction: 'debit' | 'credit'
  isDuplicate: boolean
  balanceAfter?: number
  suggestedCategory?: string
  sourceLine: string
}

interface CardStatementSummary {
  statementMonth: string
  statementDate: string | null
  dueDate: string | null
  statementAmount: number | null
  minimumDue: number | null
  /** Billing cycle covered by this statement (e.g. 15 Jun – 14 Jul). */
  cycleStartDate: string | null
  cycleEndDate: string | null
}

const LABELS = {
  statementDate: [/statement\s*date/i, /bill\s*date/i],
  dueDate: [/due\s*by\s*date/i, /payment\s*due\s*date/i, /due\s*date/i],
  statementAmount: [/total\s*(amount\s*)?due/i, /statement\s*amount/i, /amount\s*due/i, /total\s*due/i, /new\s*balance/i],
  minimumDue: [/minimum\s*(amount\s*)?due/i, /min(\.|imum)?\s*due/i],
  cycleStart: [/statement\s*period/i, /billing\s*period/i, /period\s*from/i, /transaction\s*from/i, /from\s*date/i, /^from/i],
  cycleEnd: [/period\s*to/i, /transaction\s*to/i, /to\s*date/i, /^to/i],
}

/** Finds a "from … to …" range in a single token (e.g. "15-Jun-2026 to 14-Jul-2026")
 *  or across adjacent cells in a row, returning both ends. */
function scanForCycleRange(tokenRows: string[][]): { start: string | null; end: string | null } {
  for (const tokens of tokenRows) {
    // Same-cell range, e.g. "Statement Period: 15-Jun-2026 to 14-Jul-2026"
    for (const token of tokens) {
      const rangeMatch = token.match(/(\b\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,']+\d{2,4}\b)\s*(?:to|-|–)\s*(\b\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,']+\d{2,4}\b)/i)
      if (rangeMatch) {
        const start = parseStatementDate(rangeMatch[1])
        const end = parseStatementDate(rangeMatch[2])
        if (start && end) return { start, end }
      }
    }

    // Adjacent cells, e.g. ["From", "15-Jun-2026", "To", "14-Jul-2026"]
    const startIdx = tokens.findIndex((t) => LABELS.cycleStart.some((p) => p.test(t)))
    const endIdx = tokens.findIndex((t) => LABELS.cycleEnd.some((p) => p.test(t)))
    if (startIdx !== -1 && endIdx !== -1) {
      const startVal = parseStatementDate(tokens[startIdx + 1] ?? '')
      const endVal = parseStatementDate(tokens[endIdx + 1] ?? '')
      if (startVal && endVal) return { start: startVal, end: endVal }
    }
  }
  return { start: null, end: null }
}

/** Splits a free-text line into "cell-like" tokens the same way a spreadsheet
 *  row already is one — so the same label→value scan works for both PDF text
 *  and CSV/XLSX rows. */
function tokenize(line: string): string[] {
  return line.split(/\s{2,}|\t|\|/).map((t) => t.trim()).filter(Boolean)
}

function scanForLabeledValue<T>(
  rowsOfTokens: string[][],
  labelPatterns: RegExp[],
  parseValue: (raw: string) => T | null,
): T | null {
  for (const tokens of rowsOfTokens) {
    for (let i = 0; i < tokens.length; i++) {
      if (!labelPatterns.some((p) => p.test(tokens[i]))) continue
      // Value is usually the same cell (e.g. "Due Date: 20-Jul'25") or one of the
      // next few cells (spreadsheet layout: label cell, then value cell).
      const sameCell = tokens[i].replace(new RegExp(labelPatterns.map((p) => p.source).join('|'), 'i'), '')
      const candidate = parseValue(sameCell)
      if (candidate !== null) return candidate
      for (let j = i + 1; j < Math.min(i + 4, tokens.length); j++) {
        const val = parseValue(tokens[j])
        if (val !== null) return val
      }
    }
  }
  return null
}

function toTokenRows(content: ExtractedContent): string[][] {
  return content.format === 'table' ? content.rows : content.lines.map(tokenize)
}

export function extractCardSummary(content: ExtractedContent, warnings: string[]): CardStatementSummary {
  const tokenRows = toTokenRows(content)

  const statementDate = scanForLabeledValue(tokenRows, LABELS.statementDate, parseStatementDate)
  const dueDate = scanForLabeledValue(tokenRows, LABELS.dueDate, parseStatementDate)
  const statementAmount = scanForLabeledValue(tokenRows, LABELS.statementAmount, parseAmount)
  const minimumDue = scanForLabeledValue(tokenRows, LABELS.minimumDue, parseAmount)
  const { start: cycleStartDate, end: cycleEndDate } = scanForCycleRange(tokenRows)

  if (!dueDate || statementAmount === null) {
    warnings.push(
      'Could not confidently find the due date and/or total amount due on this statement — please fill in or confirm those fields manually before saving.',
    )
  }

  const anchorDate = statementDate ?? dueDate
  const statementMonth = anchorDate
    ? `${anchorDate.slice(0, 7)}-01`
    : `${new Date().toISOString().slice(0, 7)}-01`

  return { statementMonth, statementDate, dueDate, statementAmount, minimumDue, cycleStartDate, cycleEndDate }
}

export function parseCardStatement(
  content: ExtractedContent,
  warnings: string[],
  provider?: BankProvider,
): { transactions: ParsedTransaction[]; summary: CardStatementSummary } {
  const summary = extractCardSummary(content, warnings)
  const transactions = parseBankStatement(content, warnings, provider)
  return { transactions, summary }
}
