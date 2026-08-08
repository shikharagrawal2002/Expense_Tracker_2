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
  /** 'open' | 'closed' when this expense is linked to a split group; null otherwise */
  split_status: 'open' | 'closed' | null
  created_at: string
  updated_at: string
  // convenience joins, populated by the API layer's select() when available
  account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'>
  transfer_account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'>
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>
}

export type NewTransaction = Pick<Transaction, 'account_id' | 'type' | 'amount' | 'occurred_at'> &
  Partial<Pick<Transaction, 'category_id' | 'transfer_account_id' | 'notes' | 'location' | 'currency' | 'import_batch_id' | 'split_status'>>

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
  /** Start of the billing cycle covered by this statement, e.g. "2026-06-15" */
  cycle_start_date: string | null
  /** End of the billing cycle covered by this statement, e.g. "2026-07-14" */
  cycle_end_date: string | null
  /** Snapshot of the account's current_balance before this statement was marked paid; null if unpaid. */
  balance_before_payment: number | null
}

export type NewCardStatement = Pick<CardStatement, 'account_id' | 'statement_month' | 'statement_amount' | 'due_date'> &
  Partial<Pick<CardStatement, 'minimum_due' | 'import_batch_id' | 'cycle_start_date' | 'cycle_end_date'>>

// ----------------------------------------------------------------------------
// Shapes returned by the `parse-statement` edge function (kept in sync with
// supabase/functions/parse-statement/lib/types.ts)
// ----------------------------------------------------------------------------

export type BankProvider = 'hsbc' | 'idfc' | 'slice' | 'icici' | 'hdfc' | 'sbi' | 'yesbank' | 'indusind' | 'axis' | 'generic'

export interface SplitParticipant {
  id: string
  split_group_id: string
  name: string
  share_amount: number
  is_settled: boolean
  settled_at: string | null
}

export type NewSplitParticipant = Pick<SplitParticipant, 'name' | 'share_amount'>

export interface SplitGroup {
  id: string
  user_id: string
  transaction_id: string | null
  title: string
  total_amount: number
  created_at: string
  is_closed: boolean
  closed_at: string | null
  // convenience joins
  transaction?: Pick<Transaction, 'id' | 'amount' | 'occurred_at' | 'notes' | 'currency'> & {
    account?: Pick<Account, 'id' | 'name'>
  }
  participants?: SplitParticipant[]
}

export type NewSplitGroup = Pick<SplitGroup, 'title' | 'total_amount'> &
  Partial<Pick<SplitGroup, 'transaction_id'>> & {
    participants: NewSplitParticipant[]
  }

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

export interface SmsSource {
  id: string
  user_id: string
  sender_phone: string
  bank_name: string
  upi_vpa: string | null
  is_active: boolean
  created_at: string
}

export type SmsStatus = 'pending' | 'confirmed' | 'skipped' | 'duplicate'

export interface SmsTransaction {
  id: string
  user_id: string
  sender_phone: string
  raw_text: string
  received_at: string
  parsed_at: string | null
  account_id: string | null
  amount: number | null
  type: 'debit' | 'credit' | null
  description: string | null
  merchant: string | null
  upi_ref: string | null
  status: SmsStatus
  confirmed_at: string | null
  transaction_id: string | null
  created_at: string
  // convenience joins
  account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'>
}

export interface CardStatementSummary {
  statementMonth: string
  statementDate: string | null
  dueDate: string | null
  statementAmount: number | null
  minimumDue: number | null
  /** Billing cycle covered by this statement (e.g. 15 Jun – 14 Jul). */
  cycleStartDate: string | null
  cycleEndDate: string | null
}

export interface ParseStatementResult {
  transactions: ParsedTransaction[]
  cardSummary?: CardStatementSummary
  warnings: string[]
}
