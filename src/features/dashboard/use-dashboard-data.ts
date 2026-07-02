import { useQuery } from '@tanstack/react-query'
import { useAccounts } from '@/features/accounts/hooks'
import { useMonthlyTrend } from '@/features/analytics/hooks'
import { supabase } from '@/lib/supabase/client'

export interface DashboardKpis {
  netWorth: number
  currentMonthNet: number
  savingsRate: number // 0-100
  creditUtilization: number // 0-100
  healthScore: number // 0-100, simple heuristic — see comment below
}

export function useDashboardKpis() {
  const accountsQuery = useAccounts()
  const trendQuery = useMonthlyTrend(2)

  const isLoading = accountsQuery.isLoading || trendQuery.isLoading
  const isError = accountsQuery.isError || trendQuery.isError

  const accounts = accountsQuery.data ?? []
  const netWorth = accounts.reduce((sum, a) => sum + a.current_balance, 0)

  const creditCards = accounts.filter((a) => a.type === 'credit_card' && a.credit_limit)
  const totalCreditLimit = creditCards.reduce((sum, a) => sum + (a.credit_limit ?? 0), 0)
  const totalCreditUsed = creditCards.reduce((sum, a) => sum + Math.abs(Math.min(0, a.current_balance)), 0)
  const creditUtilization = totalCreditLimit > 0 ? Math.round((totalCreditUsed / totalCreditLimit) * 100) : 0

  const latestMonth = trendQuery.data?.[trendQuery.data.length - 1]
  const currentMonthNet = latestMonth ? latestMonth.income - latestMonth.expense : 0
  const savingsRate =
    latestMonth && latestMonth.income > 0 ? Math.round((currentMonthNet / latestMonth.income) * 100) : 0

  // Simple heuristic, not a financial model: rewards a healthy savings rate and
  // penalizes high credit utilization. Weighted 60/40, clamped to 0-100.
  const rawScore = 0.6 * Math.max(0, savingsRate) + 0.4 * (100 - creditUtilization)
  const healthScore = Math.round(Math.min(100, Math.max(0, rawScore)))

  const data: DashboardKpis = { netWorth, currentMonthNet, savingsRate, creditUtilization, healthScore }
  return { data, isLoading, isError }
}

/** Bills + subscriptions merged and sorted by due date, for the dashboard's "upcoming" widget. */
export function useUpcomingDues(limit = 4) {
  return useQuery({
    queryKey: ['dashboard-upcoming-dues', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('recurring_rules')
        .select('id, label, amount, next_due_date, is_subscription, is_bill')
        .eq('is_active', true)
        .or('is_subscription.eq.true,is_bill.eq.true')
        .order('next_due_date', { ascending: true })
        .limit(limit)
      if (error) throw error
      return data as { id: string; label: string; amount: number; next_due_date: string; is_subscription: boolean; is_bill: boolean }[]
    },
  })
}
