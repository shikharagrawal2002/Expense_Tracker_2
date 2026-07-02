import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface CategorySlice {
  categoryId: string
  name: string
  color: string
  total: number
}

export function useCategoryBreakdown(monthsBack = 1) {
  return useQuery({
    queryKey: ['analytics-category-breakdown', monthsBack],
    queryFn: async (): Promise<CategorySlice[]> => {
      const since = new Date()
      since.setMonth(since.getMonth() - monthsBack)

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, category:categories(id,name,color)')
        .eq('type', 'expense')
        .gte('occurred_at', since.toISOString())
      if (error) throw error

      const totals = new Map<string, CategorySlice>()
      for (const row of data as unknown as { amount: number; category: { id: string; name: string; color: string } | null }[]) {
        const cat = row.category
        const key = cat?.id ?? 'uncategorized'
        const existing = totals.get(key)
        if (existing) {
          existing.total += row.amount
        } else {
          totals.set(key, {
            categoryId: key,
            name: cat?.name ?? 'Uncategorized',
            color: cat?.color ?? '#94a3b8',
            total: row.amount,
          })
        }
      }
      return [...totals.values()].sort((a, b) => b.total - a.total)
    },
  })
}

export interface MonthlyPoint {
  month: string
  income: number
  expense: number
}

export function useMonthlyTrend(monthsCount = 6) {
  return useQuery({
    queryKey: ['analytics-monthly-trend', monthsCount],
    queryFn: async (): Promise<MonthlyPoint[]> => {
      const since = new Date()
      since.setMonth(since.getMonth() - (monthsCount - 1))
      since.setDate(1)

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, type, occurred_at')
        .in('type', ['income', 'expense'])
        .gte('occurred_at', since.toISOString())
      if (error) throw error

      const buckets = new Map<string, MonthlyPoint>()
      for (let i = 0; i < monthsCount; i++) {
        const d = new Date(since)
        d.setMonth(d.getMonth() + i)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        buckets.set(key, { month: d.toLocaleDateString('en-IN', { month: 'short' }), income: 0, expense: 0 })
      }

      for (const row of data as unknown as { amount: number; type: 'income' | 'expense'; occurred_at: string }[]) {
        const d = new Date(row.occurred_at)
        const key = `${d.getFullYear()}-${d.getMonth()}`
        const bucket = buckets.get(key)
        if (!bucket) continue
        if (row.type === 'income') bucket.income += row.amount
        else bucket.expense += row.amount
      }

      return [...buckets.values()]
    },
  })
}

export function useDailySpendHeatmap(monthDate: Date) {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  return useQuery({
    queryKey: ['analytics-heatmap', year, month],
    queryFn: async (): Promise<Record<number, number>> => {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 1)

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, occurred_at')
        .eq('type', 'expense')
        .gte('occurred_at', start.toISOString())
        .lt('occurred_at', end.toISOString())
      if (error) throw error

      const byDay: Record<number, number> = {}
      for (const row of data as unknown as { amount: number; occurred_at: string }[]) {
        const day = new Date(row.occurred_at).getDate()
        byDay[day] = (byDay[day] ?? 0) + row.amount
      }
      return byDay
    },
  })
}
