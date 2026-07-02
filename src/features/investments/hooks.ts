import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PieChart, CandlestickChart, Bitcoin, Coins, Landmark, ShieldCheck, Building2, HandCoins } from 'lucide-react'
import { fetchHoldings, createHolding, deleteHolding, type NewHolding, type InvestmentType } from '@/features/investments/api'

const HOLDINGS_KEY = ['holdings'] as const

export function useHoldings() {
  return useQuery({ queryKey: HOLDINGS_KEY, queryFn: fetchHoldings })
}

export function useCreateHolding() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewHolding) => createHolding(input),
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
