import { useQuery } from '@tanstack/react-query'
import { useAccounts } from '@/features/accounts/hooks'
import { useTotalOwed } from '@/features/splits/hooks'
import { supabase } from '@/lib/supabase/client'

export interface DashboardKpis {
  creditUtilization: number // 0-100
  healthScore: number // 0-100, simple heuristic
  owedToYou: number
}

export function useDashboardKpis() {
  const accountsQuery = useAccounts()
  const owedQuery = useTotalOwed()

  const isLoading = accountsQuery.isLoading || owedQuery.isLoading
  const isError = accountsQuery.isError || owedQuery.isError

  const accounts = accountsQuery.data ?? []

  const creditCards = accounts.filter((a) => a.type === 'credit_card' && a.credit_limit)
  const totalCreditLimit = creditCards.reduce((sum, a) => sum + (a.credit_limit ?? 0), 0)
  const totalCreditUsed = creditCards.reduce((sum, a) => sum + Math.abs(Math.min(0, a.current_balance)), 0)
  const creditUtilization = totalCreditLimit > 0 ? Math.round((totalCreditUsed / totalCreditLimit) * 100) : 0

  // Simple heuristic: penalize high credit utilization. Clamped to 0-100.
  const healthScore = Math.round(Math.min(100, Math.max(0, 100 - creditUtilization)))

  const data: DashboardKpis = { creditUtilization, healthScore, owedToYou: owedQuery.data ?? 0 }
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

export interface CreditCardAlert {
  accountId: string
  accountName: string
  dueDate: string
  statementAmount: number
  minimumDue: number | null
  utilizationPct: number | null
  isDueSoon: boolean
  isHighUtilization: boolean
}

/** Unpaid card statements, joined with each card's credit limit to flag both
 *  "due soon" (within a week) and "high utilization" (>30% of the limit) —
 *  the two things that actually put you at risk of interest/late fees. */
export function useCreditCardAlerts(dueSoonDays = 7, highUtilizationPct = 30) {
  return useQuery({
    queryKey: ['dashboard-credit-card-alerts'],
    queryFn: async (): Promise<CreditCardAlert[]> => {
      const { data, error } = await supabase
        .from('card_statements')
        .select('due_date, statement_amount, minimum_due, account:accounts(id,name,credit_limit)')
        .eq('is_paid', false)
        .order('due_date', { ascending: true })
      if (error) throw error

      return (
        data as unknown as {
          due_date: string
          statement_amount: number
          minimum_due: number | null
          account: { id: string; name: string; credit_limit: number | null } | null
        }[]
      ).map((row) => {
        const utilizationPct = row.account?.credit_limit
          ? Math.round((row.statement_amount / row.account.credit_limit) * 100)
          : null
        return {
          accountId: row.account?.id ?? '',
          accountName: row.account?.name ?? 'Unknown card',
          dueDate: row.due_date,
          statementAmount: row.statement_amount,
          minimumDue: row.minimum_due,
          utilizationPct,
          isDueSoon: daysUntilDate(row.due_date) <= dueSoonDays,
          isHighUtilization: (utilizationPct ?? 0) > highUtilizationPct,
        }
      })
    },
  })
}

function daysUntilDate(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

/** All-time reward points across every card statement — a simple running total. */
export function useTotalRewardPoints() {
  return useQuery({
    queryKey: ['dashboard-reward-points'],
    queryFn: async (): Promise<number> => {
      const { data, error } = await supabase.from('card_statements').select('reward_points_earned')
      if (error) throw error
      return (data ?? []).reduce((sum, row) => sum + Number(row.reward_points_earned ?? 0), 0)
    },
  })
}