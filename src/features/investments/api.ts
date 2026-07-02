import { supabase } from '@/lib/supabase/client'

export type InvestmentType = 'mutual_fund' | 'stock' | 'crypto' | 'gold' | 'fd' | 'ppf' | 'nps' | 'epf' | 'bond' | 'other'

export interface Holding {
  id: string
  user_id: string
  name: string
  type: InvestmentType
  risk_level: 'low' | 'medium' | 'high' | null
  current_value: number
  invested_amount: number
}

export interface NewHolding {
  name: string
  type: InvestmentType
  risk_level?: 'low' | 'medium' | 'high'
  current_value: number
  invested_amount: number
}

export async function fetchHoldings(): Promise<Holding[]> {
  const { data, error } = await supabase.from('investment_holdings').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as Holding[]
}

export async function createHolding(input: NewHolding): Promise<Holding> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('investment_holdings')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as Holding
}

export async function deleteHolding(id: string): Promise<void> {
  const { error } = await supabase.from('investment_holdings').delete().eq('id', id)
  if (error) throw error
}
