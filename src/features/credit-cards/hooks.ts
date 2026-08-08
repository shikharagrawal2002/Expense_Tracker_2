import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchCreditCardSummaries, fetchCardStatementHistory, setCardStatementPaid } from '@/features/credit-cards/api'

export function useCreditCardSummaries() {
  return useQuery({ queryKey: ['credit-card-summaries'], queryFn: fetchCreditCardSummaries })
}

export function useCardStatementHistory(accountId: string | undefined) {
  return useQuery({
    queryKey: ['card-statement-history', accountId],
    queryFn: () => fetchCardStatementHistory(accountId as string),
    enabled: !!accountId,
  })
}

export function useSetCardStatementPaid() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isPaid }: { id: string; isPaid: boolean }) => setCardStatementPaid(id, isPaid),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['credit-card-summaries'] })
      queryClient.invalidateQueries({ queryKey: ['card-statement-history'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] }) // balance changed
    },
  })
}
