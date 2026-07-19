import type { CardStatementSummary, ExtractedContent, ParsedTransaction } from './types.ts'
import { parseAmount, parseStatementDate } from './parse-helpers.ts'
import { parseBankStatement } from './bank-parsers.ts'

const LABELS = {
  statementDate: [/statement\s*date/i, /bill\s*date/i],
  dueDate: [/due\s*by\s*date/i, /payment\s*due\s*date/i, /due\s*date/i],
  statementAmount: [/total\s*(amount\s*)?due/i, /statement\s*amount/i, /amount\s*due/i, /total\s*due/i, /new\s*balance/i],
  minimumDue: [/minimum\s*(amount\s*)?due/i, /min(\.|imum)?\s*due/i],
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

  if (!dueDate || statementAmount === null) {
    warnings.push(
      'Could not confidently find the due date and/or total amount due on this statement — please fill in or confirm those fields manually before saving.',
    )
  }

  const anchorDate = statementDate ?? dueDate
  const statementMonth = anchorDate
    ? `${anchorDate.slice(0, 7)}-01`
    : `${new Date().toISOString().slice(0, 7)}-01`

  return { statementMonth, statementDate, dueDate, statementAmount, minimumDue }
}

export function parseCardStatement(
  content: ExtractedContent,
  warnings: string[],
): { transactions: ParsedTransaction[]; summary: CardStatementSummary } {
  const summary = extractCardSummary(content, warnings)
  const transactions = parseBankStatement(content, warnings)
  return { transactions, summary }
}
