import { Landmark, Wallet, CreditCard, Smartphone, TrendingUp, HandCoins } from 'lucide-react'
import type { AccountType } from '@/lib/supabase/types'

export const ACCOUNT_TYPE_META: Record<AccountType, { label: string; icon: typeof Landmark; color: string }> = {
  bank: { label: 'Bank', icon: Landmark, color: '#5b6ef5' },
  cash: { label: 'Cash', icon: Wallet, color: '#34d399' },
  credit_card: { label: 'Credit Card', icon: CreditCard, color: '#fb7185' },
  wallet: { label: 'Wallet', icon: Smartphone, color: '#fbbf24' },
  investment: { label: 'Investment', icon: TrendingUp, color: '#38bdf8' },
  loan: { label: 'Loan', icon: HandCoins, color: '#f97316' },
}

export const ACCOUNT_TYPES = Object.keys(ACCOUNT_TYPE_META) as AccountType[]
