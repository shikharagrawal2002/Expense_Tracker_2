import { createClient } from 'npm:@supabase/supabase-js@2.110.0'
import type { ParsedTransaction } from './types.ts'

function signature(date: string, amount: number): string {
  return `${date}|${amount.toFixed(2)}`
}

/** Flags parsed rows whose date+amount already exists as a transaction on this
 *  account, so the review UI can pre-uncheck them instead of double-importing.
 *  Uses the caller's own JWT (passed through from the request) so RLS just
 *  naturally scopes this to their rows — no service-role key needed. */
export async function flagDuplicates(
  authHeader: string | null,
  accountId: string,
  transactions: ParsedTransaction[],
): Promise<ParsedTransaction[]> {
  if (transactions.length === 0) return transactions

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey || !authHeader) return transactions

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })

  const dates = transactions.map((t) => t.date).sort()
  const minDate = dates[0]
  const maxDate = dates[dates.length - 1]

  const { data, error } = await supabase
    .from('transactions')
    .select('occurred_at, amount')
    .eq('account_id', accountId)
    .gte('occurred_at', minDate)
    .lte('occurred_at', `${maxDate}T23:59:59`)

  if (error || !data) return transactions

  const existing = new Set(
    data.map((row: { occurred_at: string; amount: number }) =>
      signature(String(row.occurred_at).slice(0, 10), Number(row.amount)),
    ),
  )

  return transactions.map((t) => ({
    ...t,
    isDuplicate: existing.has(signature(t.date, t.amount)),
  }))
}
