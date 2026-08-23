import { supabase } from '@/lib/supabase/client'
import type { Account, NewAccount } from '@/lib/supabase/types'
import { decryptField, decryptNumberField, encryptField, encryptNumberField } from '@/lib/crypto/fields'

// Sensitive fields encrypted end-to-end before they reach Supabase.
const SENSITIVE_FIELDS = ['name', 'current_balance', 'opening_balance', 'credit_limit', 'interest_rate'] as const

async function encryptAccountRow(row: Record<string, unknown>): Promise<Record<string, unknown>> {
  const result = { ...row }
  for (const field of SENSITIVE_FIELDS) {
    const value = result[field]
    if (typeof value === 'string' && value !== '') {
      result[field] = (await encryptField(value)) ?? value
    } else if (typeof value === 'number') {
      result[field] = (await encryptNumberField(value)) ?? String(value)
    }
  }
  return result
}

async function decryptAccounts(rows: Account[]): Promise<Account[]> {
  const decrypted: Account[] = []
  for (const row of rows) {
    const name = await decryptField(row.name)
    const balance = await decryptNumberField(String(row.current_balance))
    const opening = await decryptNumberField(String(row.opening_balance))
    const creditLimit = row.credit_limit !== null && row.credit_limit !== undefined
      ? (await decryptNumberField(String(row.credit_limit))) ?? row.credit_limit
      : row.credit_limit
    const interest = row.interest_rate !== null && row.interest_rate !== undefined
      ? (await decryptNumberField(String(row.interest_rate))) ?? row.interest_rate
      : row.interest_rate
    decrypted.push({
      ...row,
      name: name ?? row.name,
      current_balance: balance ?? row.current_balance,
      opening_balance: opening ?? row.opening_balance,
      credit_limit: creditLimit,
      interest_rate: interest,
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