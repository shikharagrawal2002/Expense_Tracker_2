import { supabase } from '@/lib/supabase/client'
import type { Transaction, NewTransaction } from '@/lib/supabase/types'

export interface TransactionFilters {
  search?: string
  /** One or more account IDs to filter by. When empty, all accounts are shown. */
  accountIds?: string[]
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
  // the source. With multiple accounts selected, a transaction matches if
  // either side is one of the selected accounts.
  if (filters.accountIds && filters.accountIds.length > 0) {
    const ids = filters.accountIds.join(',')
    query = query.or(`account_id.in.(${ids}),transfer_account_id.in.(${ids})`)
  }
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.search) query = query.ilike('notes', `%${filters.search}%`)
  if (filters.dateFrom) query = query.gte('occurred_at', filters.dateFrom)
  if (filters.dateTo) query = query.lte('occurred_at', filters.dateTo)

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
  const { error } = await supabase.rpc('edit_transaction', {
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
  // After editing, fetch the updated transaction to return it
  const { data: updatedTxn, error: fetchError } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', input.id)
    .single()
  if (fetchError) throw fetchError
  return updatedTxn as Transaction
}

/** Reconstructs what the selected accounts' (or, if accountIds is empty, every
 *  account's combined) balance was at the end of a given date.
 *
 *  This delegates to the get_balance_as_of() Postgres function (migration
 *  0019) so the sum happens in SQL — the previous client-side implementation
 *  fetched every transaction up to the date into the browser, but Supabase's
 *  JS client caps a single select at 1000 rows, so once a user had more than
 *  1000 transactions before the as-of date the query silently truncated and
 *  the reconstructed balance was wildly wrong (e.g. -₹83L).
 *
 *  It also deliberately starts from opening_balance and applies transactions
 *  forward, rather than working backwards from current_balance — because
 *  credit-card accounts have their current_balance reset to 0 by
 *  set_card_statement_paid() (migration 0010) when a statement is marked paid,
 *  while the underlying transactions remain in the ledger. The ledger is the
 *  source of truth. */
export async function fetchBalanceAsOf(accountIds: string[], asOfDate: string): Promise<number> {
  const { data, error } = await supabase.rpc('get_balance_as_of', {
    p_account_ids: accountIds.length > 0 ? accountIds : null,
    p_as_of_date: asOfDate,
  })
  if (error) throw error
  return Number(data ?? 0)
}

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}