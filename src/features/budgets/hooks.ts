import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBudgets, fetchSpendByCategory, createBudget, deleteBudget, type NewBudget } from '@/features/budgets/api'

export function useBudgetsWithSpend(periodMonth: string) {
  const budgetsQuery = useQuery({
    queryKey: ['budgets', periodMonth],
    queryFn: () => fetchBudgets(periodMonth),
  })
  const spendQuery = useQuery({
    queryKey: ['budget-spend', periodMonth],
    queryFn: () => fetchSpendByCategory(periodMonth),
  })

  const combined = budgetsQuery.data?.map((budget) => ({
    ...budget,
    spent: (budget.category_id && spendQuery.data?.[budget.category_id]) || 0,
  }))

  return {
    data: combined,
    isLoading: budgetsQuery.isLoading || spendQuery.isLoading,
    isError: budgetsQuery.isError || spendQuery.isError,
  }
}

export function useCreateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewBudget) => createBudget(input),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['budgets', variables.period_month] })
    },
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteBudget(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['budgets'] }),
  })
}
