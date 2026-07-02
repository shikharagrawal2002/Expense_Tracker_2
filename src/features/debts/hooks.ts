import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchDebts, createDebt, recordRepayment, deleteDebt, type NewDebt, type Debt } from '@/features/debts/api'

const DEBTS_KEY = ['debts'] as const

export function useDebts() {
  return useQuery({ queryKey: DEBTS_KEY, queryFn: fetchDebts })
}

export function useCreateDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewDebt) => createDebt(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEBTS_KEY }),
  })
}

export function useRecordRepayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ debt, amount }: { debt: Debt; amount: number }) =>
      recordRepayment(debt.id, amount, debt.outstanding_amount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEBTS_KEY }),
  })
}

export function useDeleteDebt() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteDebt(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: DEBTS_KEY }),
  })
}
