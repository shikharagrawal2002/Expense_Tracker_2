// Hand-written types mirroring supabase/migrations/0001_init.sql.
// Once you run `supabase gen types typescript`, you can replace this file
// with the generated `Database` type and derive these via `Tables<'accounts'>` etc.
// Keeping them hand-written for now means the app compiles without a live project.

export type AccountType = 'bank' | 'cash' | 'credit_card' | 'wallet' | 'investment' | 'loan'
export type TransactionType = 'income' | 'expense' | 'transfer'
export type CategoryKind = 'income' | 'expense' | 'transfer' | 'investment'

export interface Account {
  id: string
  user_id: string
  name: string
  type: AccountType
  currency: string
  opening_balance: number
  current_balance: number
  color: string
  icon: string
  is_archived: boolean
  credit_limit: number | null
  billing_cycle_day: number | null
  payment_due_day: number | null
  interest_rate: number | null
  created_at: string
  updated_at: string
}

export type NewAccount = Pick<Account, 'name' | 'type' | 'currency' | 'opening_balance'> &
  Partial<Pick<Account, 'color' | 'icon' | 'credit_limit' | 'billing_cycle_day' | 'payment_due_day' | 'interest_rate'>>

export interface Category {
  id: string
  user_id: string | null
  parent_id: string | null
  name: string
  kind: CategoryKind
  icon: string
  color: string
  is_needs_wants: 'needs' | 'wants' | 'savings' | null
  sort_order: number
}

export interface Transaction {
  id: string
  user_id: string
  account_id: string
  transfer_account_id: string | null
  category_id: string | null
  merchant_id: string | null
  type: TransactionType
  amount: number
  currency: string
  occurred_at: string
  notes: string | null
  location: string | null
  is_reconciled: boolean
  attachment_url: string | null
  import_batch_id: string | null
  created_at: string
  updated_at: string
  // convenience joins, populated by the API layer's select() when available
  account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'>
  transfer_account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'>
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>
}

export type NewTransaction = Pick<Transaction, 'account_id' | 'type' | 'amount' | 'occurred_at'> &
  Partial<Pick<Transaction, 'category_id' | 'transfer_account_id' | 'notes' | 'location' | 'currency' | 'import_batch_id'>>

// ----------------------------------------------------------------------------
// Statement imports (bank statement + credit card statement uploads)
// ----------------------------------------------------------------------------

export type ImportSource = 'csv' | 'bank_statement'
export type ImportStatus = 'pending' | 'processing' | 'completed' | 'failed'

export interface ImportBatch {
  id: string
  user_id: string
  account_id: string | null
  source: ImportSource
  file_name: string | null
  row_count: number | null
  imported_count: number | null
  duplicate_count: number | null
  status: ImportStatus
  raw_result: unknown
  created_at: string
}

export type NewImportBatch = Pick<ImportBatch, 'source' | 'account_id'> &
  Partial<Pick<ImportBatch, 'file_name' | 'row_count' | 'imported_count' | 'duplicate_count' | 'status' | 'raw_result'>>

export interface CardStatement {
  id: string
  account_id: string
  statement_month: string
  statement_amount: number
  due_date: string
  minimum_due: number | null
  is_paid: boolean
  paid_at: string | null
  reward_points_earned: number
  import_batch_id: string | null
}

export type NewCardStatement = Pick<CardStatement, 'account_id' | 'statement_month' | 'statement_amount' | 'due_date'> &
  Partial<Pick<CardStatement, 'minimum_due' | 'import_batch_id'>>

// ----------------------------------------------------------------------------
// Shapes returned by the `parse-statement` edge function (kept in sync with
// supabase/functions/parse-statement/lib/types.ts)
// ----------------------------------------------------------------------------

export type ParsedDirection = 'debit' | 'credit'

export interface ParsedTransaction {
  date: string
  description: string
  amount: number
  direction: ParsedDirection
  isDuplicate: boolean
  balanceAfter?: number
  suggestedCategory?: string
  sourceLine: string
}

export interface CardStatementSummary {
  statementMonth: string
  statementDate: string | null
  dueDate: string | null
  statementAmount: number | null
  minimumDue: number | null
}

export interface ParseStatementResult {
  transactions: ParsedTransaction[]
  cardSummary?: CardStatementSummary
  warnings: string[]
}
