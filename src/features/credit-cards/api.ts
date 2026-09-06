import { supabase } from '@/lib/supabase/client'
import type { Account, CardStatement } from '@/lib/supabase/types'

export interface CreditCardSummary {
  account: Account
  latestStatement: CardStatement | null
  utilizationPct: number | null
  pendingBalance: number // Total outstanding across all unpaid statements
  effectiveUtilizationPct: number | null // Utilization based on pending balance
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
    const accountStatements = (statements as CardStatement[] | null)?.filter((s) => s.account_id === account.id) ?? []
    const latestStatement = accountStatements[0] ?? null

    // Calculate pending balance: sum of all unpaid statement amounts
    const pendingBalance = accountStatements
      .filter((s) => !s.is_paid)
      .reduce((sum, s) => sum + s.statement_amount, 0)

    // Original utilization based on current_balance (may be 0 if statements are marked paid)
    const utilizationPct = account.credit_limit
      ? Math.round((Math.abs(account.current_balance) / account.credit_limit) * 100)
      : null

    // Effective utilization based on pending balance (all unpaid statements)
    const effectiveUtilizationPct = account.credit_limit
      ? Math.round((pendingBalance / account.credit_limit) * 100)
      : null

    return {
      account,
      latestStatement,
      utilizationPct,
      pendingBalance,
      effectiveUtilizationPct,
    }
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

/** Marks a card statement as paid (or unpaid), resets the card's balance to 0, and stamps paid_at. */
export async function setCardStatementPaid(id: string, isPaid: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_card_statement_paid', {
    p_id: id,
    p_is_paid: isPaid,
  })
  if (error) throw error
  // The RPC handles the balance reset internally — do NOT call recalculateBalances()
  // here, as it would recompute from transactions and overwrite the reset.
}

/** Recomputes every account's current_balance from the transaction ledger.
 *  Idempotent — safe to call after any operation that may have caused the
 *  incremental balance-sync triggers to drift. */
export async function recalculateBalances(accountIds?: string[]): Promise<void> {
  const { error } = await supabase.rpc('recalculate_balances', {
    p_account_ids: accountIds && accountIds.length > 0 ? accountIds : null,
  })
  if (error) throw error
}
