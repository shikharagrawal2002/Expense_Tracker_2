import { useEffect, useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PieChart, CandlestickChart, Bitcoin, Coins, Landmark, ShieldCheck, Building2, HandCoins } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import {
  fetchHoldings,
  createHolding,
  updateHolding,
  deleteHolding,
    fetchHoldingTransactions,
  fetchAllInvestmentTransactions,
  fetchPortfolioHistory,
  parsePortfolioFile,
  refreshNavValues,
    type HoldingUpdate,
  type NewHolding,
  type HoldingTransaction,
  type InvestmentType,
  type PortfolioReportType,
} from '@/features/investments/api'

const HOLDINGS_KEY = ['holdings'] as const

/** Auto-refresh cadence (ms) so NAV/price changes show up without a manual tap. */
export const HOLDINGS_REFETCH_MS = 60_000

export function useHoldings() {
  const queryClient = useQueryClient()

  const query = useQuery({
    queryKey: HOLDINGS_KEY,
    queryFn: fetchHoldings,
    refetchInterval: HOLDINGS_REFETCH_MS,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  })

  // True real-time: any write to the user's holdings (this device, another
  // device, or the refresh-nav edge function) pushes the list back in sync.
  useEffect(() => {
    const channel = supabase
      .channel('investment_holdings_live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'investment_holdings' },
        () => {
          queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY })
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [queryClient])

  return query
}

export function useCreateHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewHolding) => createHolding(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY }),
  })
}

/** Edits a holding in place — used when you want to correct units or bump the
 *  current value between NAV refreshes. */
export function useUpdateHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & HoldingUpdate) => updateHolding(id, patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY }),
  })
}

export function useDeleteHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteHolding(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY }),
  })
}

/** Buy/SIP/redemption history for one holding — feeds the XIRR cashflow series. */
export function useHoldingTransactions(holdingId: string | null) {
  return useQuery({
    queryKey: ['holding-transactions', holdingId],
    queryFn: () => fetchHoldingTransactions(holdingId as string),
    enabled: Boolean(holdingId),
  })
}

/** Whole-portfolio transaction history, grouped by holding id. Used to compute a
 *  real money-weighted XIRR per holding from its actual SIP dates. */
export function useAllHoldingTransactions() {
  const query = useQuery({
    queryKey: ['holding-transactions', 'all'],
    queryFn: fetchAllInvestmentTransactions,
  })

  const byHolding = useMemo(() => {
    const map = new Map<string, HoldingTransaction[]>()
    for (const t of query.data ?? []) {
      const list = map.get(t.holding_id) ?? []
      list.push(t)
      map.set(t.holding_id, list)
    }
    return map
  }, [query.data])

    return { ...query, byHolding }
}

export function usePortfolioHistory(months = 6) {
  return useQuery({
    queryKey: ['portfolio-history', months],
    queryFn: () => fetchPortfolioHistory(months),
  })
}

/** Uploads a Groww mutual-fund export to the parse-portfolio edge function,
 *  which upserts holdings + transaction history, then refreshes the list. */
export function useParsePortfolio() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (params: { file: File; reportType?: PortfolioReportType; password?: string }) =>
      parsePortfolioFile(params),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY }),
  })
}

/** Fetches the latest AMFI NAVs and updates the current_value of the user's
 *  mutual-fund holdings in real-time, then refreshes the holdings list. */
export function useRefreshNav() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshNavValues(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: HOLDINGS_KEY }),
  })
}

export const INVESTMENT_TYPE_META: Record<InvestmentType, { label: string; icon: typeof PieChart; color: string }> = {
  mutual_fund: { label: 'Mutual Fund', icon: PieChart, color: '#38bdf8' },
  stock: { label: 'Stock', icon: CandlestickChart, color: '#6366f1' },
  crypto: { label: 'Crypto', icon: Bitcoin, color: '#f97316' },
  gold: { label: 'Gold', icon: Coins, color: '#eab308' },
  fd: { label: 'Fixed Deposit', icon: Landmark, color: '#22c55e' },
  ppf: { label: 'PPF', icon: ShieldCheck, color: '#14b8a6' },
  nps: { label: 'NPS', icon: Building2, color: '#8b5cf6' },
  epf: { label: 'EPF', icon: Building2, color: '#8b5cf6' },
  bond: { label: 'Bond', icon: HandCoins, color: '#94a3b8' },
  other: { label: 'Other', icon: PieChart, color: '#94a3b8' },
}

export const INVESTMENT_TYPES = Object.keys(INVESTMENT_TYPE_META) as InvestmentType[]
