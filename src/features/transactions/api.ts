import { supabase } from '@/lib/supabase/client'
import type { Transaction, NewTransaction } from '@/lib/supabase/types'

export interface TransactionFilters {
  search?: string
  accountId?: string
  categoryId?: string
  type?: Transaction['type']
  /** inclusive, ISO date (yyyy-mm-dd) or full timestamp */
  dateFrom?: string
  /** inclusive, ISO date (yyyy-mm-dd) or full timestamp */
  dateTo?: string
}

const SELECT_WITH_JOINS =
  '*, account:accounts!transactions_account_id_fkey(id,name,color,icon), transfer_account:accounts!transactions_transfer_account_id_fkey(id,name,color,icon), category:categories(id,name,color,icon)'

export async function fetchTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  let query = supabase
    .from('transactions')
    .select(SELECT_WITH_JOINS)
    .order('occurred_at', { ascending: false })
    .limit(500)

  // Matches account_id (the source of every income/expense/transfer, and the
  // destination for non-transfers where transfer_account_id is null) OR
  // transfer_account_id (the destination side of a transfer) — so filtering by
  // an account shows transfers where that account was either side, not just
  // the source.
  if (filters.accountId) {
    query = query.or(`account_id.eq.${filters.accountId},transfer_account_id.eq.${filters.accountId}`)
  }
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.search) query = query.ilike('notes', `%${filters.search}%`)
  if (filters.dateFrom) query = query.gte('occurred_at', `${filters.dateFrom}T00:00:00+05:30`)
  if (filters.dateTo) query = query.lte('occurred_at', `${filters.dateTo}T23:59:59.999+05:30`)

  const { data, error } = await query
  if (error) throw error
  return data as unknown as Transaction[]
}

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('transactions')
    .insert({ ...input, user_id: userId, currency: input.currency ?? 'INR' })
    .select(SELECT_WITH_JOINS)
    .single()
  if (error) throw error
  return data as unknown as Transaction
}

export interface EditTransactionInput {
  id: string
  account_id: string
  transfer_account_id?: string | null
  category_id?: string | null
  type: Transaction['type']
  amount: number
  occurred_at: string
  notes?: string | null
}

/** Uses the edit_transaction() Postgres function (migration 0004) so the
 *  account-balance reversal/reapply happens atomically, since the balance
 *  trigger only fires on INSERT/DELETE and not on UPDATE. */
export async function editTransaction(input: EditTransactionInput): Promise<Transaction> {
  const { data, error } = await supabase.rpc('edit_transaction', {
    p_id: input.id,
    p_account_id: input.account_id,
    p_transfer_account_id: input.transfer_account_id ?? null,
    p_category_id: input.category_id ?? null,
    p_type: input.type,
    p_amount: input.amount,
    p_occurred_at: input.occurred_at,
    p_notes: input.notes ?? null,
  })
  if (error) throw error
  return data as Transaction
}

/** Reconstructs what an account's (or, if accountId is omitted, every
 *  account's combined) balance was at the end of a given date, by taking the
 *  current authoritative balance and undoing every transaction that happened
 *  strictly after that date. This avoids assuming a zero starting balance or
 *  needing a separate balance-history table. */
export async function fetchBalanceAsOf(accountId: string | undefined, beforeDate: string): Promise<number> {
  let accountsQuery = supabase.from('accounts').select('id, current_balance')
  if (accountId) accountsQuery = accountsQuery.eq('id', accountId)
  const { data: accounts, error: accountsError } = await accountsQuery
  if (accountsError) throw accountsError
  if (!accounts || accounts.length === 0) return 0

  const currentTotal = accounts.reduce((sum, a) => sum + Number(a.current_balance), 0)

  let txnQuery = supabase
    .from('transactions')
    .select('type, amount, account_id, transfer_account_id')
    .gte('occurred_at', `${beforeDate}T00:00:00+05:30`)

  if (accountId) {
    txnQuery = txnQuery.or(`account_id.eq.${accountId},transfer_account_id.eq.${accountId}`)
  }

  const { data: laterTxns, error: txnError } = await txnQuery
  if (txnError) throw txnError

  let deltaSinceThen = 0
  for (const t of laterTxns ?? []) {
    const amount = Number(t.amount)
    if (t.type === 'income') {
      deltaSinceThen += amount
    } else if (t.type === 'expense') {
      deltaSinceThen -= amount
    } else if (t.type === 'transfer') {
      // Across the whole portfolio a transfer nets to zero, but for a single
      // account it's a debit on one side and a credit on the other.
      if (!accountId) continue
      if (t.account_id === accountId) deltaSinceThen -= amount
      if (t.transfer_account_id === accountId) deltaSinceThen += amount
    }
  }

  return currentTotal - deltaSinceThen
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
