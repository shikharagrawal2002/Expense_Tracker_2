import { supabase } from '@/lib/supabase/client'
import type { Account, NewAccount } from '@/lib/supabase/types'
import { decryptField, encryptField } from '@/lib/crypto/fields'

// Only free-text fields are E2E encrypted. Numeric fields (balances, limits,
// rates) must remain plain NUMERIC so SQL-side aggregation (recalculate_balances,
// get_balance_as_of, reports) works correctly.
const ENCRYPTED_FIELDS = ['name'] as const

async function encryptAccountRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...row }
  for (const field of ENCRYPTED_FIELDS) {
    const value = result[field]
    if (typeof value === 'string' && value !== '') {
      result[field] = (await encryptField(value)) ?? value
    }
  }
  return result
}

async function decryptAccounts(rows: Account[]): Promise<Account[]> {
  const decrypted: Account[] = []
  for (const row of rows) {
    const name = await decryptField(row.name)
    decrypted.push({
      ...row,
      name: name ?? row.name,
    })
  }
  return decrypted
}

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return await decryptAccounts(data as Account[])
}

export async function createAccount(input: NewAccount): Promise<Account> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const row = {
    ...input,
    user_id: userId,
    current_balance: input.opening_balance,
  }
  const encrypted = await encryptAccountRow(row)
  const { data, error } = await supabase
    .from('accounts')
    .insert(encrypted as never)
    .select('*')
    .single()
  if (error) throw error
  const rows = await decryptAccounts([data as Account])
  return rows[0]
}

export async function updateAccount(id: string, patch: Partial<NewAccount>): Promise<Account> {
  const encrypted = await encryptAccountRow({ ...patch } as Record<string, unknown>)
  const { data, error } = await supabase
    .from('accounts')
    .update(encrypted as never)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  const rows = await decryptAccounts([data as Account])
  return rows[0]
}

export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}