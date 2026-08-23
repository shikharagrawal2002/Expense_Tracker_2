import { supabase } from '@/lib/supabase/client'
import type { Transaction, NewTransaction } from '@/lib/supabase/types'
import { decryptField, encryptField } from '@/lib/crypto/fields'

async function encryptTxnRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...row }
  if (typeof result.notes === 'string' && result.notes !== '') {
    result.notes = (await encryptField(result.notes)) ?? result.notes
  }
  if (typeof result.amount === 'number') {
    result.amount = (await encryptField(String(result.amount))) ?? String(result.amount)
  }
  if (typeof result.location === 'string' && result.location !== '') {
    result.location = (await encryptField(result.location)) ?? result.location
  }
  return result
}

async function decryptTxns(rows: Transaction[]): Promise<Transaction[]> {
  const decrypted: Transaction[] = []
  for (const row of rows) {
    const notes = row.notes ? await decryptField(row.notes) : row.notes
    const amountStr = await decryptField(String(row.amount))
    const location = row.location ? await decryptField(row.location) : row.location
    const amount = amountStr ? Number(amountStr) : row.amount
    decrypted.push({
      ...row,
      notes: notes ?? row.notes,
      location: location ?? row.location,
      amount: Number.isNaN(amount) ? row.amount : amount,
    })
  }
  return decrypted
}

export interface TransactionFilters {
  search?: string
  accountIds?: string[]
  categoryId?: string
  type?: Transaction['type']
  dateFrom?: string
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
  return await decryptTxns(data as unknown as Transaction[])
}

export async function createTransaction(input: NewTransaction): Promise<Transaction> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const row = { ...input, user_id: userId, currency: input.currency ?? 'INR' }
  const encrypted = await encryptTxnRow(row as Record<string, unknown>)
  const { data, error } = await supabase
    .from('transactions')
    .insert(encrypted as never)
    .select(SELECT_WITH_JOINS)
    .single()
  if (error) throw error
  const rows = await decryptTxns([data as unknown as Transaction])
  return rows[0]
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

export async function editTransaction(input: EditTransactionInput): Promise<Transaction> {
  const notes = input.notes ? (await encryptField(input.notes)) ?? input.notes : null
  const { error } = await supabase.rpc('edit_transaction', {
    p_id: input.id,
    p_account_id: input.account_id,
    p_transfer_account_id: input.transfer_account_id ?? null,
    p_category_id: input.category_id ?? null,
    p_type: input.type,
    p_amount: input.amount,
    p_occurred_at: input.occurred_at,
    p_notes: notes,
  })
  if (error) throw error

  const { data: updatedTxn, error: fetchError } = await supabase
    .from('transactions')
    .select(SELECT_WITH_JOINS)
    .eq('id', input.id)
    .single()
  if (fetchError) throw fetchError
  const rows = await decryptTxns([updatedTxn as unknown as Transaction])
  return rows[0]
}

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