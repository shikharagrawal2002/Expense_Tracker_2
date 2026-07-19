export type ImportKind = 'bank' | 'card'

export interface ParseRequestBody {
  kind: ImportKind
  fileName: string
  mimeType: string
  /** Raw file bytes, base64-encoded (no "data:" prefix). */
  fileBase64: string
  /** Account this statement belongs to — used for the duplicate check and,
   *  for card statements, to read billing_cycle_day/payment_due_day defaults. */
  accountId: string
  /** Optional issuer hint ('icici' | 'hdfc' | 'sbi' | 'axis' | 'generic' ...).
   *  Falls back to the generic heuristic parser when omitted/unrecognized. */
  provider?: string
}

export type Direction = 'debit' | 'credit'

export interface ParsedTransaction {
  /** ISO date (yyyy-mm-dd). */
  date: string
  description: string
  amount: number
  direction: Direction
  /** true if a transaction with the same date+amount+account already exists. */
  isDuplicate: boolean
  /** running balance from the statement, if the source included one. */
  balanceAfter?: number
  /** best-effort category name guess based on the description, if any matched. */
  suggestedCategory?: string
  /** the original row/line this was parsed from, kept for the review UI. */
  sourceLine: string
}

export interface CardStatementSummary {
  statementMonth: string // yyyy-mm-01
  statementDate: string | null
  dueDate: string | null
  statementAmount: number | null
  minimumDue: number | null
}

export interface ParseResult {
  transactions: ParsedTransaction[]
  cardSummary?: CardStatementSummary
  warnings: string[]
}

/** Either a spreadsheet-like grid (csv/xlsx) or plain text lines (pdf). */
export type ExtractedContent =
  | { format: 'table'; rows: string[][] }
  | { format: 'text'; lines: string[] }
