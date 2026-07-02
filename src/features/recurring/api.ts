import { supabase } from '@/lib/supabase/client'

export type RecurrenceFreq = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly' | 'yearly'

export interface RecurringRule {
  id: string
  user_id: string
  account_id: string
  category_id: string | null
  label: string
  type: 'income' | 'expense' | 'transfer'
  amount: number
  frequency: RecurrenceFreq
  next_due_date: string
  is_subscription: boolean
  is_bill: boolean
  reminder_days_before: number
  is_active: boolean
  account?: { id: string; name: string }
}

export interface NewRecurringRule {
  account_id: string
  label: string
  amount: number
  frequency: RecurrenceFreq
  next_due_date: string
  is_subscription?: boolean
  is_bill?: boolean
  type?: 'income' | 'expense' | 'transfer'
}

export async function fetchRecurringRules(filter: 'subscription' | 'bill'): Promise<RecurringRule[]> {
  const column = filter === 'subscription' ? 'is_subscription' : 'is_bill'
  const { data, error } = await supabase
    .from('recurring_rules')
    .select('*, account:accounts(id,name)')
    .eq(column, true)
    .eq('is_active', true)
    .order('next_due_date', { ascending: true })
  if (error) throw error
  return data as unknown as RecurringRule[]
}

export async function createRecurringRule(input: NewRecurringRule): Promise<RecurringRule> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('recurring_rules')
    .insert({ ...input, user_id: userId, type: input.type ?? 'expense' })
    .select('*, account:accounts(id,name)')
    .single()
  if (error) throw error
  return data as unknown as RecurringRule
}

export async function deactivateRecurringRule(id: string): Promise<void> {
  const { error } = await supabase.from('recurring_rules').update({ is_active: false }).eq('id', id)
  if (error) throw error
}

export function daysUntil(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}
