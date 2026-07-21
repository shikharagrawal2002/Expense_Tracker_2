import type { ExtractedContent, ParsedTransaction, BankProvider } from './types.ts'
import { parseAmount, parseStatementDate, detectDirectionFromText, suggestCategory, extractLeadingDate, AMOUNT_TOKEN_RE } from './parse-helpers.ts'

const HEADER_KEYWORDS = {
  date: ['date', 'txn date', 'transaction date', 'value date', 'posting date'],
  description: ['narration', 'description', 'particulars', 'details', 'remarks', 'transaction remarks'],
  debit: ['debit', 'withdrawal', 'withdrawal amt', 'dr', 'debit amount'],
  credit: ['credit', 'deposit', 'deposit amt', 'cr', 'credit amount'],
  amount: ['amount', 'txn amount', 'transaction amount'],
  balance: ['balance', 'closing balance', 'running balance', 'available balance'],
  direction: ['direction', 'dr/cr', 'transaction type', 'type'],
}

/** Bank-specific column-header synonyms, tried BEFORE the generic list above
 *  so a bank's exact wording wins over a coincidental generic match. Verified
 *  against actual exports:
 *  - hsbc: "Date " / "Transaction Details " / "Deposits" / "Withdrawals" / "\n\nBalance"
 *  - slice: "Date" / "Description" / "Amount" / "Direction" / "Balance"
 *  IDFC's real export is a PDF, not a spreadsheet — see parseTextLines / the
 *  idfc-specific block finalizer below instead of this table for that one. */
const PROVIDER_HEADER_ALIASES: Record<BankProvider, Partial<typeof HEADER_KEYWORDS>> = {
  hsbc: {
    date: ['date'],
    description: ['transaction details', 'details'],
    debit: ['withdrawals', 'withdrawal'],
    credit: ['deposits', 'deposit'],
    balance: ['balance'],
  },
  slice: {
    date: ['date'],
    description: ['description'],
    amount: ['amount'],
    balance: ['balance'],
    direction: ['direction'],
  },
  idfc: {},
  generic: {},
}

function resolveHeaderKeywords(provider?: BankProvider): typeof HEADER_KEYWORDS {
  const overrides = provider ? PROVIDER_HEADER_ALIASES[provider] : undefined
  if (!overrides) return HEADER_KEYWORDS
  const merged = { ...HEADER_KEYWORDS }
  for (const key of Object.keys(overrides) as Array<keyof typeof HEADER_KEYWORDS>) {
    const providerFirst = overrides[key]
    if (providerFirst) merged[key] = [...providerFirst, ...HEADER_KEYWORDS[key]]
  }
  return merged
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

function locateHeaderRow(rows: string[][], keywords: typeof HEADER_KEYWORDS): number {
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const row = rows[i]
    const hasDate = findColumn(row, keywords.date) !== -1
    const hasAmountish =
      findColumn(row, keywords.amount) !== -1 ||
      findColumn(row, keywords.debit) !== -1 ||
      findColumn(row, keywords.credit) !== -1
    if (hasDate && hasAmountish) return i
  }
  return -1
}

function parseTable(rows: string[][], warnings: string[], provider?: BankProvider): ParsedTransaction[] {
  const keywords = resolveHeaderKeywords(provider)
  const headerIdx = locateHeaderRow(rows, keywords)
  if (headerIdx === -1) {
    warnings.push(
      'Could not find a header row with recognizable Date/Amount columns — no transactions were extracted from the table. Try exporting a plain CSV from your bank\'s "download statement" option.',
    )
    return []
  }

  const header = rows[headerIdx]
  const col = {
    date: findColumn(header, keywords.date),
    description: findColumn(header, keywords.description),
    debit: findColumn(header, keywords.debit),
    credit: findColumn(header, keywords.credit),
    amount: findColumn(header, keywords.amount),
    balance: findColumn(header, keywords.balance),
    direction: findColumn(header, keywords.direction),
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
        // Priority: an explicit Direction/Type column beats guessing from the
        // amount cell itself — a plain positive number with no sign and no
        // CR/DR text (e.g. a dedicated "debit"/"credit" column elsewhere) would
        // otherwise always be misread as a credit.
        const directionCellText = col.direction !== -1 ? String(row[col.direction] ?? '').toLowerCase() : ''
        if (directionCellText.includes('debit') || directionCellText.includes('dr')) {
          direction = 'debit'
        } else if (directionCellText.includes('credit') || directionCellText.includes('cr')) {
          direction = 'credit'
        } else {
          direction = detectDirectionFromText(raw) ?? (parsed < 0 ? 'debit' : 'credit')
        }
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

/** Given the full text of one transaction "block" (everything from its date
 *  up to, but not including, the next transaction's date — which may span
 *  several wrapped lines plus incidental page header/footer noise), pulls out
 *  the amount and balance. Statements consistently end each transaction with
 *  "...AMOUNT BALANCE" as the last two currency tokens in the block, so the
 *  last token is the balance and the second-last is the amount — this holds
 *  even when a reference number, page footer, or the next page's running
 *  header text got appended in between. Used for statements whose amounts
 *  carry their own sign (a currency symbol + minus, or a CR/DR suffix). */
function finalizeBlock(dateIso: string, text: string): ParsedTransaction | null {
  const tokens = [...text.matchAll(AMOUNT_TOKEN_RE)].map((m) => m[0])
  if (tokens.length === 0) return null // pure noise block (page title, footer, etc.)

  const hasBalance = tokens.length >= 2
  const balanceToken = hasBalance ? tokens[tokens.length - 1] : null
  const amountToken = hasBalance ? tokens[tokens.length - 2] : tokens[0]

  const amount = parseAmount(amountToken)
  if (amount === null || amount === 0) return null
  const balance = balanceToken ? parseAmount(balanceToken) : null

  let description = text.replace(/\b\d{10,}\b/g, '') // strip long reference-number digit strings
  for (const token of tokens) description = description.split(token).join(' ')
  description = description.replace(/\s+/g, ' ').trim()

  return {
    date: dateIso,
    description: description || '(no description)',
    amount: Math.abs(amount),
    direction: amount < 0 ? 'debit' : 'credit',
    isDuplicate: false,
    balanceAfter: balance ?? undefined,
    suggestedCategory: suggestCategory(description),
    sourceLine: text,
  }
}

/** Matches a plain decimal amount with no currency symbol and no sign, e.g.
 *  "51.00", "1,64,246.04" — the format IDFC's statement uses, distinguished
 *  from a bare reference number by requiring a decimal point + exactly 2
 *  digits (reference numbers here are plain integers with no decimal). */
const PLAIN_DECIMAL_RE = /\d[\d,]*\.\d{2}/g

/** True for a line that's either the transaction table's own column-header
 *  row, or an opening/closing-balance summary row — both of which tend to
 *  repeat on every page of a multi-page statement and would otherwise leak
 *  their numbers into whichever transaction block happens to be open when
 *  the next page's header text appears. */
function looksLikeHeaderOrSummaryNoise(line: string): boolean {
  const l = line.toLowerCase()
  if (l.includes('opening balance') && l.includes('closing balance')) return true
  return (
    l.includes('date') &&
    (l.includes('amount') || l.includes('balance')) &&
    (l.includes('detail') || l.includes('particular') || l.includes('narration') || l.includes('description'))
  )
}

function findTableHeaderIndex(lines: string[]): number {
  for (let i = 0; i < lines.length; i++) {
    if (looksLikeHeaderOrSummaryNoise(lines[i])) return i
  }
  return -1
}

/** Finds the statement's own printed opening balance (e.g. "Opening Balance
 *  53,110.72"), used to seed the running balance for statements — like
 *  IDFC's — whose amounts have no sign of their own, so direction has to be
 *  inferred from how the balance moved rather than read directly. */
function findOpeningBalance(lines: string[]): number | null {
  for (const line of lines) {
    if (/opening balance/i.test(line)) {
      const numbers = [...line.matchAll(PLAIN_DECIMAL_RE)].map((m) => parseAmount(m[0]))
      if (numbers.length > 0) return numbers[numbers.length - 1]
    }
  }
  return null
}

/** For statements whose amount column has no sign, no currency symbol, and no
 *  CR/DR marker (IDFC's export: plain "51.00" whether it's a debit or a
 *  credit) — direction can't be read from the amount itself, so it's inferred
 *  from whether the running balance went up or down since the previous
 *  transaction. Returns the parsed row (or null for a noise block) and the
 *  balance to carry forward into the next call. */
function finalizeBlockByBalanceDelta(
  dateIso: string,
  text: string,
  previousBalance: number | null,
): { row: ParsedTransaction | null; nextBalance: number | null } {
  const tokens = [...text.matchAll(PLAIN_DECIMAL_RE)].map((m) => m[0])
  if (tokens.length < 2) return { row: null, nextBalance: previousBalance } // no [amount, balance] pair found

  const amount = parseAmount(tokens[tokens.length - 2])
  const newBalance = parseAmount(tokens[tokens.length - 1])
  if (amount === null || amount === 0 || newBalance === null) {
    return { row: null, nextBalance: previousBalance }
  }

  const delta = previousBalance !== null ? newBalance - previousBalance : null
  // If we somehow never found an opening balance to seed from, default to
  // debit (most statement lines are spends) rather than silently guessing credit.
  const direction: 'debit' | 'credit' = delta !== null ? (delta < 0 ? 'debit' : 'credit') : 'debit'

  let description = text.replace(/\b\d{10,}\b/g, '')
  for (const token of tokens) description = description.split(token).join(' ')
  description = description.replace(/\s+/g, ' ').trim()

  return {
    row: {
      date: dateIso,
      description: description || '(no description)',
      amount: Math.abs(amount),
      direction,
      isDuplicate: false,
      balanceAfter: newBalance,
      suggestedCategory: suggestCategory(description),
      sourceLine: text,
    },
    nextBalance: newBalance,
  }
}

/** Groups PDF text lines into per-transaction blocks (a new block starts
 *  whenever a line begins with a recognizable date) and extracts one
 *  transaction per block. This handles both plain single-line statements and
 *  ones where a long description wraps across two or three lines — common in
 *  table-style PDF statements where the date/description/ref-no/amount/balance
 *  columns don't all land on the same extracted text line. Recurring page
 *  header/summary lines are flushed as hard block boundaries wherever they
 *  appear, not just at the very start, since multi-page statements often
 *  repeat them on every page. */
function parseTextLines(lines: string[], warnings: string[], provider?: BankProvider): ParsedTransaction[] {
  const headerIdx = findTableHeaderIndex(lines)
  const startFrom = headerIdx === -1 ? 0 : headerIdx + 1
  const useBalanceDelta = provider === 'idfc'

  const out: ParsedTransaction[] = []
  let current: { date: string; text: string } | null = null
  let runningBalance = useBalanceDelta ? findOpeningBalance(lines) : null

  function flush() {
    if (!current) return
    if (useBalanceDelta) {
      const { row, nextBalance } = finalizeBlockByBalanceDelta(current.date, current.text, runningBalance)
      if (row) out.push(row)
      runningBalance = nextBalance
    } else {
      const row = finalizeBlock(current.date, current.text)
      if (row) out.push(row)
    }
    current = null
  }

  for (let i = startFrom; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) continue

    if (looksLikeHeaderOrSummaryNoise(line)) {
      flush() // don't let a repeated header/summary row's numbers leak into the open block
      continue
    }

    const lead = extractLeadingDate(line)
    if (lead) {
      flush()
      current = { date: lead.date, text: lead.rest }
    } else if (current) {
      current.text += ` ${line}`
    }
    // else: noise before the first transaction (e.g. account header details) — skip
  }
  flush()

  if (out.length === 0) {
    warnings.push(
      'No transaction-shaped lines were found in the PDF text. Scanned/image-only PDFs need OCR, which this parser does not do yet — try a text-based PDF export or a CSV/Excel download instead.',
    )
  }
  return out
}

export function parseBankStatement(
  content: ExtractedContent,
  warnings: string[],
  provider?: BankProvider,
): ParsedTransaction[] {
  return content.format === 'table'
    ? parseTable(content.rows, warnings, provider)
    : parseTextLines(content.lines, warnings, provider)
}
