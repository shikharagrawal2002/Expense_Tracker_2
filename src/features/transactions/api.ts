import { supabase } from '@/lib/supabase/client'
import type { Transaction, NewTransaction } from '@/lib/supabase/types'

export interface TransactionFilters {
  search?: string
  accountId?: string
  categoryId?: string
  type?: Transaction['type']
}

const SELECT_WITH_JOINS =
  '*, account:accounts!transactions_account_id_fkey(id,name,color,icon), category:categories(id,name,color,icon)'

export async function fetchTransactions(filters: TransactionFilters = {}): Promise<Transaction[]> {
  let query = supabase.from('transactions').select(SELECT_WITH_JOINS).order('occurred_at', { ascending: false }).limit(100)

  if (filters.accountId) query = query.eq('account_id', filters.accountId)
  if (filters.categoryId) query = query.eq('category_id', filters.categoryId)
  if (filters.type) query = query.eq('type', filters.type)
  if (filters.search) query = query.ilike('notes', `%${filters.search}%`)

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

export async function deleteTransaction(id: string): Promise<void> {
  const { error } = await supabase.from('transactions').delete().eq('id', id)
  if (error) throw error
}
