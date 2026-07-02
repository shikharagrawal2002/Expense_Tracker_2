import { supabase } from '@/lib/supabase/client'

export interface Debt {
  id: string
  user_id: string
  direction: 'borrowed' | 'lent'
  counterparty_name: string
  principal_amount: number
  outstanding_amount: number
  due_date: string | null
  notes: string | null
  is_settled: boolean
}

export interface NewDebt {
  direction: 'borrowed' | 'lent'
  counterparty_name: string
  principal_amount: number
  due_date?: string | null
  notes?: string
}

export async function fetchDebts(): Promise<Debt[]> {
  const { data, error } = await supabase.from('debts').select('*').eq('is_settled', false).order('due_date', { ascending: true })
  if (error) throw error
  return data as Debt[]
}

export async function createDebt(input: NewDebt): Promise<Debt> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('debts')
    .insert({ ...input, user_id: userId, outstanding_amount: input.principal_amount })
    .select('*')
    .single()
  if (error) throw error
  return data as Debt
}

export async function recordRepayment(debtId: string, amount: number, outstanding: number): Promise<void> {
  const nextOutstanding = Math.max(0, outstanding - amount)
  const { error: debtError } = await supabase
    .from('debts')
    .update({ outstanding_amount: nextOutstanding, is_settled: nextOutstanding === 0 })
    .eq('id', debtId)
  if (debtError) throw debtError

  const { error: repayError } = await supabase.from('debt_repayments').insert({ debt_id: debtId, amount })
  if (repayError) throw repayError
}

export async function deleteDebt(id: string): Promise<void> {
  const { error } = await supabase.from('debts').delete().eq('id', id)
  if (error) throw error
}
