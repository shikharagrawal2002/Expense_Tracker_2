// Supabase Edge Function: generate-insights
//
// Pulls the user's last 90 days of financial data (spend by category vs.
// trailing 3-month average, budget burn rate, credit utilization vs. statement
// date, top merchants, savings rate, upcoming obligations), sends a compact
// aggregate — never raw transactions — to the LLM, and stores 3–5 insights
// with a type, severity, and optional deep-link.
//
// Deploy with:
//   supabase functions deploy generate-insights
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-set on Supabase)
//   OPENAI_API_KEY (or ANTHROPIC_API_KEY) — the LLM provider key
//   LLM_PROVIDER = "openai" | "anthropic" (defaults to "openai")

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.0'

interface Insight {
  type: 'spending' | 'budget' | 'credit' | 'savings' | 'obligation' | 'merchant' | 'general'
  severity: 'info' | 'warning' | 'critical'
  title: string
  detail: string
  deepLink?: string
}

interface AggregateData {
  period: string
  totalIncome: number
  totalExpense: number
  savingsRate: number
  categorySpend: Array<{ name: string; amount: number; avg3Month: number; pctChange: number }>
  budgetBurn: Array<{ name: string; spent: number; budget: number; pctUsed: number }>
  creditUtilization: Array<{ accountName: string; utilizationPct: number; limit: number; statementDate: string | null }>
  topMerchants: Array<{ name: string; amount: number; count: number }>
  upcomingObligations: Array<{ label: string; amount: number; dueDate: string }>
}

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(supabaseUrl, supabaseKey)
}

async function callLlm(prompt: string): Promise<{ text: string; model: string; tokenCount: number }> {
  const provider = Deno.env.get('LLM_PROVIDER') ?? 'openai'
  const openaiKey = Deno.env.get('OPENAI_API_KEY')
  const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

  if (provider === 'anthropic' && anthropicKey) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        system: 'You are a personal finance analyst. Return ONLY valid JSON, no markdown.',
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) throw new Error(`Anthropic API error: ${res.status} ${await res.text()}`)
    const data = await res.json()
    const text = data.content?.[0]?.text ?? ''
    return { text, model: 'claude-3-5-sonnet-20241022', tokenCount: data.usage?.input_tokens ?? 0 }
  }

  if (openaiKey) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a personal finance analyst. Return ONLY valid JSON, no markdown. The JSON must be an array of insight objects with fields: type, severity, title, detail, deepLink (optional).',
          },
          { role: 'user', content: prompt },
        ],
        response_format: { type: 'json_object' },
      }),
    })
    if (!res.ok) throw new Error(`OpenAI API error: ${res.status} ${await res.text()}`)
    const data = await res.json()
    const text = data.choices?.[0]?.message?.content ?? ''
    return { text, model: 'gpt-4o-mini', tokenCount: data.usage?.total_tokens ?? 0 }
  }

  throw new Error('No LLM provider configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY.')
}

async function buildAggregate(userId: string, supabase: ReturnType<typeof createSupabaseClient>): Promise<AggregateData> {
  const now = new Date()
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
  const threeMonthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString()

  // Fetch transactions for the last 90 days
  const { data: transactions, error: txnError } = await supabase
    .from('transactions')
    .select('amount, type, occurred_at, category:categories(name), merchant:merchants(name), notes')
    .gte('occurred_at', ninetyDaysAgo)
    .order('occurred_at', { ascending: true })

  if (txnError) throw txnError

  const txns = (transactions ?? []) as unknown as Array<{
    amount: number
    type: string
    occurred_at: string
    category: { name: string } | null
    merchant: { name: string } | null
    notes: string | null
  }>

  // Income / expense totals
  let totalIncome = 0
  let totalExpense = 0
  for (const t of txns) {
    if (t.type === 'income') totalIncome += t.amount
    else if (t.type === 'expense') totalExpense += t.amount
  }
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0

  // Category spend (current 90 days vs trailing 3-month average)
  const categorySpendMap = new Map<string, { name: string; amount: number; avg3Month: number }>()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    const name = t.category?.name ?? 'Uncategorized'
    const entry = categorySpendMap.get(name) ?? { name, amount: 0, avg3Month: 0 }
    entry.amount += t.amount
    categorySpendMap.set(name, entry)
  }

  // Fetch transactions from 3-6 months ago for the trailing average
  const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: olderTxns } = await supabase
    .from('transactions')
    .select('amount, type, occurred_at, category:categories(name)')
    .gte('occurred_at', sixMonthsAgo)
    .lt('occurred_at', threeMonthsAgo)

  const older = (olderTxns ?? []) as unknown as Array<{
    amount: number
    type: string
    category: { name: string } | null
  }>
  const olderCategoryMap = new Map<string, number>()
  for (const t of older) {
    if (t.type !== 'expense') continue
    const name = t.category?.name ?? 'Uncategorized'
    olderCategoryMap.set(name, (olderCategoryMap.get(name) ?? 0) + t.amount)
  }

  const categorySpend = [...categorySpendMap.entries()].map(([name, entry]) => {
    const olderAmount = olderCategoryMap.get(name) ?? 0
    const avg3Month = olderAmount / 3
    const pctChange = avg3Month > 0 ? ((entry.amount - avg3Month) / avg3Month) * 100 : 0
    return { name, amount: entry.amount, avg3Month, pctChange }
  }).sort((a, b) => b.amount - a.amount).slice(0, 10)

  // Budget burn rate
  const { data: budgets } = await supabase
    .from('budgets')
    .select('*, category:categories(name)')
    .eq('month', now.toISOString().slice(0, 7))

  const budgetBurn = ((budgets ?? []) as unknown as Array<{
    amount: number
    category: { name: string } | null
  }>).map((b) => {
    const spent = categorySpend.find((c) => c.name === b.category?.name)?.amount ?? 0
    return {
      name: b.category?.name ?? 'Unknown',
      spent,
      budget: b.amount,
      pctUsed: b.amount > 0 ? (spent / b.amount) * 100 : 0,
    }
  }).filter((b) => b.budget > 0)

  // Credit utilization
  const { data: creditAccounts } = await supabase
    .from('accounts')
    .select('id, name, credit_limit, current_balance, payment_due_day')
    .eq('type', 'credit_card')
    .eq('is_archived', false)

  const creditUtilization = ((creditAccounts ?? []) as unknown as Array<{
    id: string
    name: string
    credit_limit: number | null
    current_balance: number
    payment_due_day: number | null
  }>).map((a) => ({
    accountName: a.name,
    utilizationPct: a.credit_limit ? Math.round((Math.abs(a.current_balance) / a.credit_limit) * 100) : 0,
    limit: a.credit_limit ?? 0,
    statementDate: a.payment_due_day ? `Day ${a.payment_due_day} of month` : null,
  }))

  // Top merchants
  const merchantMap = new Map<string, { name: string; amount: number; count: number }>()
  for (const t of txns) {
    if (t.type !== 'expense') continue
    const name = t.merchant?.name ?? t.notes?.split(' ').slice(0, 3).join(' ') ?? 'Unknown'
    const entry = merchantMap.get(name) ?? { name, amount: 0, count: 0 }
    entry.amount += t.amount
    entry.count += 1
    merchantMap.set(name, entry)
  }
  const topMerchants = [...merchantMap.values()].sort((a, b) => b.amount - a.amount).slice(0, 5)

  // Upcoming obligations (recurring rules due in next 14 days)
  const { data: recurring } = await supabase
    .from('recurring_rules')
    .select('label, amount, next_due_date')
    .eq('is_active', true)
    .lte('next_due_date', new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))

  const upcomingObligations = ((recurring ?? []) as unknown as Array<{
    label: string
    amount: number
    next_due_date: string
  }>).map((r) => ({ label: r.label, amount: r.amount, dueDate: r.next_due_date }))

  return {
    period: 'last_90_days',
    totalIncome,
    totalExpense,
    savingsRate,
    categorySpend,
    budgetBurn,
    creditUtilization,
    topMerchants,
    upcomingObligations,
  }
}

function buildPrompt(aggregate: AggregateData): string {
  return `Analyze this user's financial data for the last 90 days and generate 3-5 actionable insights.

Return a JSON object with an "insights" array. Each insight must have:
- type: one of "spending", "budget", "credit", "savings", "obligation", "merchant", "general"
- severity: one of "info", "warning", "critical"
- title: short headline (max 60 chars)
- detail: 1-2 sentence explanation with specific numbers
- deepLink: optional route path like "/budgets", "/credit-cards", "/transactions", "/subscriptions", "/bills", "/investments"

Data:
${JSON.stringify(aggregate, null, 2)}

Rules:
- Focus on the most important findings, not generic advice
- Flag spending increases >20% vs 3-month average
- Flag budget categories over 80% used
- Flag credit utilization over 30%
- Flag low savings rate (<10%)
- Mention upcoming obligations within 7 days
- Use Indian Rupee formatting (₹) in details
- Keep it concise and specific`
}

function parseInsights(text: string): Insight[] {
  try {
    // Try to extract JSON from the response (handle markdown code fences)
    const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
    const parsed = JSON.parse(cleaned)
    const insights = Array.isArray(parsed) ? parsed : parsed.insights
    if (!Array.isArray(insights)) return []
    return insights
      .filter((i) => i && typeof i === 'object' && i.title && i.detail)
      .slice(0, 5)
      .map((i) => ({
        type: i.type ?? 'general',
        severity: i.severity ?? 'info',
        title: String(i.title),
        detail: String(i.detail),
        deepLink: i.deepLink ? String(i.deepLink) : undefined,
      }))
  } catch {
    return []
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ error: 'Not authenticated' }, 401)

    // Extract user ID from JWT
    const token = authHeader.replace(/^Bearer\s+/i, '')
    let userId: string
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      userId = payload.sub
    } catch {
      return jsonResponse({ error: 'Invalid token' }, 401)
    }

    const supabase = createSupabaseClient()

    // Check if a fresh insight already exists for today (rate limiting)
    const today = new Date().toISOString().slice(0, 10)
    const { data: existing } = await supabase
      .from('ai_insights')
      .select('id, generated_at')
      .eq('user_id', userId)
      .gte('generated_at', today)
      .order('generated_at', { ascending: false })
      .limit(1)

    if (existing && existing.length > 0) {
      return jsonResponse({ cached: true, generatedAt: existing[0].generated_at })
    }

    // Build the aggregate data
    const aggregate = await buildAggregate(userId, supabase)

    // Call the LLM
    const prompt = buildPrompt(aggregate)
    const { text, model, tokenCount } = await callLlm(prompt)
    const insights = parseInsights(text)

    if (insights.length === 0) {
      return jsonResponse({ error: 'LLM returned no valid insights' }, 422)
    }

    // Store the insights
    const { data: stored, error: storeError } = await supabase
      .from('ai_insights')
      .insert({
        user_id: userId,
        generated_at: new Date().toISOString(),
        period: 'last_90_days',
        insights,
        model,
        token_count: tokenCount,
      })
      .select('*')
      .single()

    if (storeError) throw storeError

    return jsonResponse({ cached: false, generatedAt: stored.generated_at, insights })
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500,
    )
  }
})