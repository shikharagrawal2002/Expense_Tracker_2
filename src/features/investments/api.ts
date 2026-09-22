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
  purchased_at: string
  category?: string
  nav_value?: number
  nav_date?: string
  isin?: string
  scheme_code?: string
  units?: number
  average_cost?: number
  created_at?: string
  updated_at?: string
}

/** Mirrors the `investment_transactions.type` CHECK constraint from migration 0021
 *  (the set the Groww importer and this app both write). */
export type HoldingTransactionType = 'buy' | 'sip' | 'redemption' | 'switch_in' | 'switch_out' | 'dividend'

export interface HoldingWithMetrics extends Holding {
  gain: number
  gainPct: number
  yearsHeld: number
  cagr?: number
  xirr?: number
  taxLiability?: number
  rank?: number
}

export interface HoldingTransaction {
  id: string
  holding_id: string
  user_id: string
  amount: number
  type: 'buy' | 'sip' | 'redemption' | 'switch_in' | 'switch_out' | 'dividend'
  units?: number
  nav?: number
  transaction_date: string
  scheme_code?: string | null
  isin?: string | null
  source?: string
  external_ref?: string | null
}

/** Payload accepted by {@link createHolding}. Mirrors the columns the
 *  dashboard/edge functions write, so manual holdings and Groww imports end up
 *  with the same shape. */
export interface NewHolding {
  name: string
  type: InvestmentType
  invested_amount: number
  current_value: number
  /** ISO date (YYYY-MM-DD). Defaults to today in the database when omitted —
   *  needed for XIRR/CAGR and to classify long- vs short-term tax liability. */
  purchased_at?: string
  risk_level?: 'low' | 'medium' | 'high' | null
  category?: string | null
  units?: number
  average_cost?: number
}

export type HoldingUpdate = Partial<NewHolding> & {
  nav_value?: number | null
  nav_date?: string | null
  scheme_code?: string | null
  isin?: string | null
}

export interface PortfolioSummary {
  totalInvested: number
  totalCurrent: number
  totalGain: number
  gainPct: number
  holdingsCount: number
  byType: Record<InvestmentType, { count: number; value: number; invested: number }>
}

export async function fetchHoldings(): Promise<Holding[]> {
  const { data, error } = await supabase
    .from('investment_holdings')
    .select('*')
    .order('created_at', { ascending: true })
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

export async function updateHolding(id: string, patch: HoldingUpdate): Promise<void> {
  const { error } = await supabase
    .from('investment_holdings')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

export async function deleteHolding(id: string): Promise<void> {
  const { error } = await supabase
    .from('investment_holdings')
    .delete()
    .eq('id', id)
  if (error) throw error
}

export async function fetchHoldingTransactions(holdingId: string): Promise<HoldingTransaction[]> {
  const { data, error } = await supabase
    .from('investment_transactions')
    .select('*')
    .eq('holding_id', holdingId)
    .order('transaction_date', { ascending: true })
  if (error) throw error
  return data as HoldingTransaction[]
}

/** Every investment transaction for the user in one round-trip, keyed by holding.
 *  XIRR needs each holding's real cashflow dates, and fetching per row would mean
 *  one request per holding (and a hook inside a loop on the client). */
export async function fetchAllHoldingTransactions(): Promise<Record<string, HoldingTransaction[]>> {
  const { data, error } = await supabase
    .from('investment_transactions')
    .select('*')
    .order('transaction_date', { ascending: true })
  if (error) throw error

  const byHolding: Record<string, HoldingTransaction[]> = {}
  for (const row of (data ?? []) as HoldingTransaction[]) {
    if (!row.holding_id) continue
    ;(byHolding[row.holding_id] ??= []).push(row)
  }
  return byHolding
}

/** Every buy/SIP/redemption across the whole portfolio in one round-trip — the
 *  investments page needs the full history to compute a per-holding XIRR
 *  without firing one query per row. */
export async function fetchAllInvestmentTransactions(): Promise<HoldingTransaction[]> {
  const { data, error } = await supabase
    .from('investment_transactions')
    .select('*')
    .order('transaction_date', { ascending: true })
  if (error) throw error
  return data as HoldingTransaction[]
}

export async function fetchPortfolioHistory(months: number = 6): Promise<Array<{ month: string; invested: number; current: number }>> {
  const { data, error } = await supabase
    .from('investment_holdings')
    .select('created_at, invested_amount, current_value')
    .order('created_at', { ascending: true })
  if (error) throw error
  
  const monthsData: Record<string, { invested: number; current: number }> = {}
  const holdings = data as Holding[]
  
  // Group by month (simulated - in real app would use actual transaction history)
    for (const h of holdings) {
    const month = (h.created_at ?? new Date().toISOString()).slice(0, 7)
    if (!monthsData[month]) {
      monthsData[month] = { invested: 0, current: 0 }
    }
    monthsData[month].invested += h.invested_amount
    monthsData[month].current += h.current_value
  }
  
  // Fill in missing months for a continuous chart
  const result: Array<{ month: string; invested: number; current: number }> = []
  const sortedMonths = Object.keys(monthsData).sort()
  if (sortedMonths.length > 0) {
    for (let i = 0; i < months; i++) {
      const d = new Date()
      d.setMonth(d.getMonth() - (months - 1 - i))
      const month = d.toISOString().slice(0, 7)
      result.push({
        month,
        invested: monthsData[month]?.invested ?? 0,
        current: monthsData[month]?.current ?? 0,
      })
    }
  }
  return result
}

export async function updateHoldingNav(holdingId: string, navValue: number, navDate: string): Promise<void> {
  const { error } = await supabase
    .from('investment_holdings')
    .update({ nav_value: navValue, nav_date: navDate })
    .eq('id', holdingId)
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
