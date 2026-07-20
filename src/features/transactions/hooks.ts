import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchTransactions,
  createTransaction,
  editTransaction,
  deleteTransaction,
  fetchBalanceAsOf,
  type TransactionFilters,
  type EditTransactionInput,
} from '@/features/transactions/api'
import type { NewTransaction } from '@/lib/supabase/types'

export function useTransactions(filters: TransactionFilters = {}) {
  return useQuery({
    queryKey: ['transactions', filters],
    queryFn: () => fetchTransactions(filters),
  })
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTransaction) => createTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] }) // balances changed
    },
  })
}

export function useEditTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: EditTransactionInput) => editTransaction(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['balance-as-of'] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
      queryClient.invalidateQueries({ queryKey: ['balance-as-of'] })
    },
  })
}

/** The closing balance as of the end of `asOfDate` (yyyy-mm-dd), for the given
 *  account or, if omitted, combined across all accounts. */
export function useBalanceAsOf(accountId: string | undefined, asOfDate: string | undefined) {
  return useQuery({
    queryKey: ['balance-as-of', accountId ?? 'all', asOfDate],
    queryFn: () => fetchBalanceAsOf(accountId, asOfDate as string),
    enabled: !!asOfDate,
  })
}
