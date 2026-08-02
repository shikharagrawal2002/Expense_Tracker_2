import { useQuery } from '@tanstack/react-query'
import { fetchCreditCardSummaries, fetchCardStatementHistory } from '@/features/credit-cards/api'

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
