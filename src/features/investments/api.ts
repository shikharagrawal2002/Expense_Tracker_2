import { supabase } from '@/lib/supabase/client'

export type InvestmentType = 'mutual_fund' | 'stock' | 'crypto' | 'gold' | 'fd' | 'ppf' | 'nps' | 'epf' | 'bond' | 'other'

export type PortfolioReportType = 'holdings' | 'transactions' | 'capital-gains'

export interface ParsePortfolioResult {
  reportType: PortfolioReportType
  holdingsDetected?: number
  matched?: number
  created?: number
  updated?: number
  transactionsDetected?: number
  inserted?: number
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // reader.result is a data: URL ("data:<mime>;base64,AAAA...") — strip the prefix
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

/** Uploads a Groww mutual-fund export (Holdings/Transactions/Capital-gains)
 *  to the parse-portfolio edge function, which upserts investment_holdings
 *  and investment_transactions for the current user. */
export async function parsePortfolioFile(params: {
  file: File
  reportType?: PortfolioReportType
  password?: string
}): Promise<ParsePortfolioResult> {
  const fileBase64 = await readFileAsBase64(params.file)
  const { data, error } = await supabase.functions.invoke<ParsePortfolioResult>('parse-portfolio', {
    body: {
      reportType: params.reportType,
      password: params.password || undefined,
      fileName: params.file.name,
      mimeType: params.file.type,
      fileBase64,
    },
  })
  if (error) throw error
  if (!data) throw new Error('The parser returned no data')
  return data
}

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

export interface RefreshNavResult {
  updated: number
  matched: number
  total: number
  holdings: Array<{ id: string; name: string; current_value: number; nav: number; nav_date: string }>
}

/** Calls the refresh-nav edge function to fetch the latest AMFI NAVs and
 *  update the current_value of the user's mutual-fund holdings in real-time. */
export async function refreshNavValues(): Promise<RefreshNavResult> {
  const { data, error } = await supabase.functions.invoke<RefreshNavResult>('refresh-nav', {
    method: 'POST',
  })
  if (error) throw error
  if (!data) throw new Error('The NAV refresh returned no data')
  return data
}
