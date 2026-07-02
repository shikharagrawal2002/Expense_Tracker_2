import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAccounts, createAccount, updateAccount, archiveAccount } from '@/features/accounts/api'
import type { Account, NewAccount } from '@/lib/supabase/types'

const ACCOUNTS_KEY = ['accounts'] as const

export function useAccounts() {
  return useQuery({ queryKey: ACCOUNTS_KEY, queryFn: fetchAccounts })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewAccount) => createAccount(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY })
      const previous = queryClient.getQueryData<Account[]>(ACCOUNTS_KEY)
      const optimistic: Account = {
        id: `optimistic-${Date.now()}`,
        user_id: '',
        name: input.name,
        type: input.type,
        currency: input.currency,
        opening_balance: input.opening_balance,
        current_balance: input.opening_balance,
        color: input.color ?? '#6366f1',
        icon: input.icon ?? 'wallet',
        is_archived: false,
        credit_limit: input.credit_limit ?? null,
        billing_cycle_day: input.billing_cycle_day ?? null,
        payment_due_day: input.payment_due_day ?? null,
        interest_rate: input.interest_rate ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      queryClient.setQueryData<Account[]>(ACCOUNTS_KEY, (old) => [...(old ?? []), optimistic])
      return { previous }
    },
    onError: (_err, _input, context) => {
      if (context?.previous) queryClient.setQueryData(ACCOUNTS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewAccount> }) => updateAccount(id, patch),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })
}

export function useArchiveAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => archiveAccount(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: ACCOUNTS_KEY })
      const previous = queryClient.getQueryData<Account[]>(ACCOUNTS_KEY)
      queryClient.setQueryData<Account[]>(ACCOUNTS_KEY, (old) => old?.filter((a) => a.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(ACCOUNTS_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ACCOUNTS_KEY }),
  })
}
