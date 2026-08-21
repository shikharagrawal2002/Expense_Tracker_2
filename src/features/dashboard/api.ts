import { supabase } from '@/lib/supabase/client'

export interface AiInsight {
  type: 'spending' | 'budget' | 'credit' | 'savings' | 'obligation' | 'merchant' | 'general'
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  deepLink?: string
}

export interface AiInsightRow {
  id: string
  user_id: string
  generated_at: string
  period: string
  insights: AiInsight[]
  model: string | null
  token_count: number | null
  created_at: string
}

/** Reads the most recent cached AI insight row for the current user.
 *  Instant load — no LLM call happens client-side. */
export async function fetchLatestAiInsights(): Promise<AiInsightRow | null> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.id) return null

  const { data, error } = await supabase
    .from('ai_insights')
    .select('*')
    .eq('user_id', userData.user.id)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (error) throw error
  return data as AiInsightRow | null
}

/** Manually triggers insight regeneration via the edge function.
 *  Rate-limited server-side to a few per day (checks existing generated_at today). */
export async function refreshAiInsights(): Promise<AiInsightRow> {
  const { data, error } = await supabase.functions.invoke<{
    cached?: boolean
    generatedAt?: string
    insights?: AiInsight[]
    error?: string
  }>('generate-insights', { method: 'POST' })
  if (error) throw error

  if (data?.error) throw new Error(data.error)
  // The edge function returns cached:true when a row already exists today — in
  // that case just re-fetch the stored row so the UI shows the latest state.
  return (await fetchLatestAiInsights())!
}

/** Registers a manual confirmation with the learning layer so the merchant
 *  rule table builds up over time. */
export async function recordMerchantRule(input: {
  matcher: string
  merchant: string
  categoryId?: string | null
  accountId?: string | null
  amount?: number | null
  isCredit?: boolean
}) {
  const { error } = await supabase.rpc('record_merchant_rule', {
    p_matcher: input.matcher,
    p_merchant: input.merchant,
    p_category_id: input.categoryId ?? null,
    p_account_id: input.accountId ?? null,
    p_amount: input.amount ?? null,
    p_is_credit: input.isCredit ?? false,
  })
  if (error) throw error
}