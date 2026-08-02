import { supabase } from '@/lib/supabase/client'
import type { Category } from '@/lib/supabase/types'

export interface Budget {
  id: string
  user_id: string
  category_id: string | null
  period_month: string // 'YYYY-MM-01'
  amount_limit: number
  alert_threshold_pct: number
  category?: Pick<Category, 'id' | 'name' | 'color' | 'icon'>
}

export interface NewBudget {
  category_id: string
  period_month: string
  amount_limit: number
  alert_threshold_pct?: number
}

function monthRange(periodMonth: string) {
  const start = new Date(periodMonth + 'T00:00:00')
  const end = new Date(start.getFullYear(), start.getMonth() + 1, 1)
  return { start: start.toISOString(), end: end.toISOString() }
}

export async function fetchBudgets(periodMonth: string): Promise<Budget[]> {
  const { data, error } = await supabase
    .from('budgets')
    .select('*, category:categories(id,name,color,icon)')
    .eq('period_month', periodMonth)
  if (error) throw error
  return data as unknown as Budget[]
}

/** Sum of expense transactions per category for the given month, e.g. { [categoryId]: 4200 } —
 *  netted for splits, same as the category breakdown chart: money other people
 *  owe you back for a shared expense isn't really your own spending against the budget. */
export async function fetchSpendByCategory(periodMonth: string): Promise<Record<string, number>> {
  const { start, end } = monthRange(periodMonth)
  const { data, error } = await supabase
    .from('transactions')
    .select('category_id, amount, splits:split_groups(participants:split_participants(share_amount))')
    .eq('type', 'expense')
    .gte('occurred_at', start)
    .lt('occurred_at', end)
  if (error) throw error

  const totals: Record<string, number> = {}
  for (const row of data as unknown as {
    category_id: string | null
    amount: number
    splits: { participants: { share_amount: number }[] }[] | null
  }[]) {
    if (!row.category_id) continue
    const splitShares = (row.splits ?? []).reduce(
      (sum, group) => sum + (group.participants ?? []).reduce((s, p) => s + Number(p.share_amount), 0),
      0,
    )
    const netAmount = Math.max(0, row.amount - splitShares)
    totals[row.category_id] = (totals[row.category_id] ?? 0) + netAmount
  }
  return totals
}

export async function createBudget(input: NewBudget): Promise<Budget> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('budgets')
    .insert({ ...input, user_id: userId })
    .select('*, category:categories(id,name,color,icon)')
    .single()
  if (error) throw error
  return data as unknown as Budget
}

export async function deleteBudget(id: string): Promise<void> {
  const { error } = await supabase.from('budgets').delete().eq('id', id)
  if (error) throw error
}
