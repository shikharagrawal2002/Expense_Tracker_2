import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchRecurringRules,
  createRecurringRule,
  deactivateRecurringRule,
  markBillPaid,
  type NewRecurringRule,
} from '@/features/recurring/api'

export function useRecurringRules(filter: 'subscription' | 'bill') {
  return useQuery({ queryKey: ['recurring', filter], queryFn: () => fetchRecurringRules(filter) })
}

export function useCreateRecurringRule(filter: 'subscription' | 'bill') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewRecurringRule) => createRecurringRule(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring', filter] }),
  })
}

export function useDeactivateRecurringRule(filter: 'subscription' | 'bill') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deactivateRecurringRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['recurring', filter] }),
  })
}

export function useMarkBillPaid(filter: 'subscription' | 'bill') {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ ruleId, accountId, amount, paidOn }: { ruleId: string; accountId: string; amount?: number; paidOn?: string }) =>
      markBillPaid(ruleId, accountId, amount, paidOn),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring', filter] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
