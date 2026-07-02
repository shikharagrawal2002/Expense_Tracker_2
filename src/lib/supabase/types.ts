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
  created_at: string
  updated_at: string
  // convenience joins, populated by the API layer's select() when available
  account?: Pick<Account, 'id' | 'name' | 'color' | 'icon'>
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>
}

export type NewTransaction = Pick<Transaction, 'account_id' | 'type' | 'amount' | 'occurred_at'> &
  Partial<Pick<Transaction, 'category_id' | 'transfer_account_id' | 'notes' | 'location' | 'currency'>>
