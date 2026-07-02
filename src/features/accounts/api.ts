import { supabase } from '@/lib/supabase/client'
import type { Account, NewAccount } from '@/lib/supabase/types'

export async function fetchAccounts(): Promise<Account[]> {
  const { data, error } = await supabase
    .from('accounts')
    .select('*')
    .eq('is_archived', false)
    .order('created_at', { ascending: true })
  if (error) throw error
  return data as Account[]
}

export async function createAccount(input: NewAccount): Promise<Account> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('accounts')
    .insert({
      ...input,
      user_id: userId,
      current_balance: input.opening_balance,
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Account
}

export async function updateAccount(id: string, patch: Partial<NewAccount>): Promise<Account> {
  const { data, error } = await supabase.from('accounts').update(patch).eq('id', id).select('*').single()
  if (error) throw error
  return data as Account
}

export async function archiveAccount(id: string): Promise<void> {
  const { error } = await supabase.from('accounts').update({ is_archived: true }).eq('id', id)
  if (error) throw error
}
