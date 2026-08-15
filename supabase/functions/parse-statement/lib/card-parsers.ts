import { parseAmount, parseStatementDate, findAllDateOccurrences, INDIAN_DECIMAL_SOURCE } from './parse-helpers.ts'
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

/** Looks for a label (e.g. "Payment Due Date") anywhere in a continuous PDF
 *  text string, then searches a short window right after it for a date. Works
 *  even when the whole statement extracted as one line with no reliable
 *  breaks between fields — the same real-world quirk that affects the
 *  transaction parser (see bank-parsers.ts's preprocessPdfText). */
function findLabeledDateInText(text: string, labelPatterns: RegExp[], windowSize = 40): string | null {
  for (const labelPattern of labelPatterns) {
    const match = labelPattern.exec(text)
    if (!match || match.index === undefined) continue
    const window = text.slice(match.index + match[0].length, match.index + match[0].length + windowSize)
    const dates = findAllDateOccurrences(window)
    if (dates.length > 0) return dates[0].date
  }
  return null
}

function findLabeledAmountInText(text: string, labelPatterns: RegExp[], windowSize = 40): number | null {
  const amountRe = new RegExp(`-?₹?\\s?${INDIAN_DECIMAL_SOURCE}`)
  for (const labelPattern of labelPatterns) {
    const match = labelPattern.exec(text)
    if (!match || match.index === undefined) continue
    const window = text.slice(match.index + match[0].length, match.index + match[0].length + windowSize)
    const amountMatch = window.match(amountRe)
    if (amountMatch) {
      const parsed = parseAmount(amountMatch[0])
      if (parsed !== null) return parsed
    }
  }
  return null
}

/** Continuous-text variant of scanForCycleRange below — finds a "from … to …"
 *  billing-cycle range directly in one string via position, rather than
 *  assuming the two dates land in identifiable adjacent "cells". Tries a
 *  same-span match first (e.g. "15-Jun-2026 to 14-Jul-2026" appearing
 *  together), then falls back to locating a start-label and an end-label
 *  independently and reading the date shortly after each. */
function findCycleRangeInText(text: string): { start: string | null; end: string | null } {
  const rangeMatch = text.match(
    /(\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,']+\d{2,4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\s*(?:to|-|–)\s*(\d{1,2}[\s\-][A-Za-z]{3,9}[\s\-,']+\d{2,4}|\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})/i,
  )
  if (rangeMatch) {
    const start = parseStatementDate(rangeMatch[1])
    const end = parseStatementDate(rangeMatch[2])
    if (start && end) return { start, end }
  }

  const start = findLabeledDateInText(text, LABELS.cycleStart)
  const end = findLabeledDateInText(text, LABELS.cycleEnd)
  return { start, end }
}

/** Splits a free-text line into "cell-like" tokens the same way a spreadsheet
 *  row already is one — so the same label→value scan works for CSV/XLSX card
 *  statement exports, which do have real row/cell structure (unlike PDFs). */
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

/** Finds a "from … to …" range in a single token (e.g. "15-Jun-2026 to 14-Jul-2026")
 *  or across adjacent cells in a row, returning both ends — used for the
 *  CSV/XLSX (table) path, which has real row/cell structure. */
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

export function extractCardSummary(content: ExtractedContent, warnings: string[]): CardStatementSummary {
  let statementDate: string | null
  let dueDate: string | null
  let statementAmount: number | null
  let minimumDue: number | null
  let cycleStartDate: string | null
  let cycleEndDate: string | null

  if (content.format === 'table') {
    const tokenRows = content.rows
    statementDate = scanForLabeledValue(tokenRows, LABELS.statementDate, parseStatementDate)
    dueDate = scanForLabeledValue(tokenRows, LABELS.dueDate, parseStatementDate)
    statementAmount = scanForLabeledValue(tokenRows, LABELS.statementAmount, parseAmount)
    minimumDue = scanForLabeledValue(tokenRows, LABELS.minimumDue, parseAmount)
    ;({ start: cycleStartDate, end: cycleEndDate } = scanForCycleRange(tokenRows))
  } else {
    const fullText = content.lines.join(' ')
    statementDate = findLabeledDateInText(fullText, LABELS.statementDate)
    dueDate = findLabeledDateInText(fullText, LABELS.dueDate)
    statementAmount = findLabeledAmountInText(fullText, LABELS.statementAmount)
    minimumDue = findLabeledAmountInText(fullText, LABELS.minimumDue)
    ;({ start: cycleStartDate, end: cycleEndDate } = findCycleRangeInText(fullText))
  }

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
