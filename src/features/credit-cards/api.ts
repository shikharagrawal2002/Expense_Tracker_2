import { supabase } from '@/lib/supabase/client'
import type { Account, CardStatement } from '@/lib/supabase/types'

export interface CreditCardSummary {
  account: Account
  latestStatement: CardStatement | null
  utilizationPct: number | null
}

export async function fetchCreditCardSummaries(): Promise<CreditCardSummary[]> {
  const { data: accounts, error: accountsError } = await supabase
    .from('accounts')
    .select('*')
    .eq('type', 'credit_card')
    .eq('is_archived', false)
    .order('name')
  if (accountsError) throw accountsError
  if (!accounts || accounts.length === 0) return []

  const accountIds = accounts.map((a) => a.id)
  const { data: statements, error: statementsError } = await supabase
    .from('card_statements')
    .select('*')
    .in('account_id', accountIds)
    .order('statement_month', { ascending: false })
  if (statementsError) throw statementsError

  return (accounts as Account[]).map((account) => {
    const latestStatement = (statements as CardStatement[] | null)?.find((s) => s.account_id === account.id) ?? null
    const utilizationPct = account.credit_limit
      ? Math.round((Math.abs(account.current_balance) / account.credit_limit) * 100)
      : null
    return { account, latestStatement, utilizationPct }
  })
}

/** Full statement history for one card, newest first — for the history table. */
export async function fetchCardStatementHistory(accountId: string): Promise<CardStatement[]> {
  const { data, error } = await supabase
    .from('card_statements')
    .select('*')
    .eq('account_id', accountId)
    .order('statement_month', { ascending: false })
  if (error) throw error
  return data as CardStatement[]
}
