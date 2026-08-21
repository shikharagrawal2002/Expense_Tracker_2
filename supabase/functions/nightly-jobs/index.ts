// Supabase Edge Function: nightly-jobs
//
// Invoked nightly via pg_cron (or an external scheduler) to run:
//   1. generate-insights   — LLM insight generation for every active user
//   2. fetch-amfi-nav      — pull AMFI's NAVAll.txt into nav_history
//   3. split-reminders     — notifications for splits outstanding > N days
//
// Deploy with:
//   supabase functions deploy nightly-jobs
//
// Secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-set)
//   OPENAI_API_KEY or ANTHROPIC_API_KEY — only needed when insights is enabled
//   LLM_PROVIDER = "openai" | "anthropic"

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.0'

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(supabaseUrl, supabaseKey)
}

/** Generates AI insights for a single user. Mirrors the generate-insights
 *  function's core logic but runs nightly for every active user. */
async function generateInsightsForUser(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string,
): Promise<{ ok: boolean; insights: number } | { ok: false; error: string }> {
  try {
    // Skip if we already have insights generated in the last 20 hours
    const yesterday = new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
    const { data: existing } = await supabase
      .from('ai_insights')
      .select('id')
      .eq('user_id', userId)
      .gte('generated_at', yesterday)
      .limit(1)
    if (existing && existing.length > 0) {
      return { ok: true, insights: 0 }
    }

    // Build the compact aggregate (last 90 days)
    const now = new Date()
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString()
    const threeMonthsAgo = new Date(now.getTime() - 3 * 30 * 24 * 60 * 60 * 1000).toISOString()
    const sixMonthsAgo = new Date(now.getTime() - 6 * 30 * 24 * 60 * 60 * 1000).toISOString()

    const { data: transactions } = await supabase
      .from('transactions')
      .select('amount, type, occurred_at, category:categories(name), notes')
      .gte('occurred_at', ninetyDaysAgo)
      .order('occurred_at', { ascending: true })
    const txns = (transactions ?? []) as unknown as Array<{
      amount: number
      type: string
      occurred_at: string
      category: { name: string } | null
      notes: string | null
    }>

    let totalIncome = 0
    let totalExpense = 0
    const categoryMap = new Map<string, number>()
    for (const t of txns) {
      if (t.type === 'income') totalIncome += t.amount
      else if (t.type === 'expense') {
        totalExpense += t.amount
        const name = t.category?.name ?? 'Uncategorized'
        categoryMap.set(name, (categoryMap.get(name) ?? 0) + t.amount)
      }
    }
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpense) / totalIncome) * 100 : 0

    // Trailing 3-month average for categories
    const { data: olderTxns } = await supabase
      .from('transactions')
      .select('amount, type, category:categories(name)')
      .gte('occurred_at', sixMonthsAgo)
      .lt('occurred_at', threeMonthsAgo)
    const olderMap = new Map<string, number>()
    for (const t of (olderTxns ?? []) as unknown as Array<{ amount: number; type: string; category: { name: string } | null }>) {
      if (t.type !== 'expense') continue
      const name = t.category?.name ?? 'Uncategorized'
      olderMap.set(name, (olderMap.get(name) ?? 0) + t.amount)
    }

    const categorySpend = [...categoryMap.entries()].map(([name, amount]) => {
      const olderAmount = olderMap.get(name) ?? 0
      const avg3Month = olderAmount / 3
      const pctChange = avg3Month > 0 ? ((amount - avg3Month) / avg3Month) * 100 : 0
      return { name, amount, avg3Month, pctChange }
    }).sort((a, b) => b.amount - a.amount).slice(0, 8)

    // Budgets
    const { data: budgets } = await supabase
      .from('budgets')
      .select('amount, category:categories(name)')
      .eq('month', now.toISOString().slice(0, 7))
    const budgetBurn = ((budgets ?? []) as unknown as Array<{ amount: number; category: { name: string } | null }>)
      .map((b) => {
        const name = b.category?.name
        const spent = name ? categoryMap.get(name) ?? 0 : 0
        return { name: b.category?.name ?? 'Unknown', spent, budget: b.amount, pctUsed: b.amount > 0 ? (spent / b.amount) * 100 : 0 }
      })
      .filter((b) => b.budget > 0)

    // Credit cards
    const { data: creditAccounts } = await supabase
      .from('accounts')
      .select('name, credit_limit, current_balance, payment_due_day')
      .eq('type', 'credit_card')
      .eq('is_archived', false)
    const creditUtilization = ((creditAccounts ?? []) as unknown as Array<{
      name: string
      credit_limit: number | null
      current_balance: number
      payment_due_day: number | null
    }>).map((a) => ({
      accountName: a.name,
      utilizationPct: a.credit_limit ? Math.round((Math.abs(a.current_balance) / a.credit_limit) * 100) : 0,
      limit: a.credit_limit ?? 0,
      statementDate: a.payment_due_day ? `Day ${a.payment_due_day}` : null,
    }))

    // Upcoming
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

    const aggregate = {
      period: 'last_90_days',
      totalIncome,
      totalExpense,
      savingsRate,
      categorySpend,
      budgetBurn,
      creditUtilization,
      upcomingObligations,
    }

    // Call the LLM
    const provider = Deno.env.get('LLM_PROVIDER') ?? 'openai'
    const openaiKey = Deno.env.get('OPENAI_API_KEY')
    const anthropicKey = Deno.env.get('ANTHROPIC_API_KEY')

    let text = ''
    let model = ''
    let tokenCount = 0

    const prompt = `Analyze this user's financial data for the last 90 days and generate 3-5 actionable insights.
Return a JSON object with an "insights" array. Each insight must have:
- type: "spending" | "budget" | "credit" | "savings" | "obligation" | "merchant" | "general"
- severity: "info" | "warning" | "critical"
- title: short headline (max 60 chars)
- detail: 1-2 sentence explanation with specific numbers
- deepLink: optional route path

Data:
${JSON.stringify(aggregate, null, 2)}

Rules:
- Flag spending increases >20% vs 3-month average
- Flag budget categories over 80% used
- Flag credit utilization over 30%
- Flag low savings rate (<10%)
- Mention upcoming obligations within 7 days
- Use Indian Rupee (₹) formatting
- Keep it concise and specific`

    if (provider === 'anthropic' && anthropicKey) {
      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': anthropicKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 2000,
          system: 'You are a personal finance analyst. Return ONLY valid JSON, no markdown.',
          messages: [{ role: 'user', content: prompt }],
        }),
      })
      if (!res.ok) throw new Error(`Anthropic API ${res.status}`)
      const data = await res.json()
      text = data.content?.[0]?.text ?? ''
      model = 'claude-3-5-sonnet-20241022'
      tokenCount = data.usage?.input_tokens ?? 0
    } else if (openaiKey) {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'You are a personal finance analyst. Return ONLY valid JSON. The JSON must be an object with an "insights" array.' },
            { role: 'user', content: prompt },
          ],
          response_format: { type: 'json_object' },
        }),
      })
      if (!res.ok) throw new Error(`OpenAI API ${res.status}`)
      const data = await res.json()
      text = data.choices?.[0]?.message?.content ?? ''
      model = 'gpt-4o-mini'
      tokenCount = data.usage?.total_tokens ?? 0
    } else {
      // No LLM configured — skip silently (graceful "insights unavailable" state)
      return { ok: true, insights: 0 }
    }

    try {
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()
      const parsed = JSON.parse(cleaned)
      const insights = Array.isArray(parsed) ? parsed : parsed.insights
      if (!Array.isArray(insights) || insights.length === 0) return { ok: true, insights: 0 }
      const typed = insights.slice(0, 5).map((i: Record<string, unknown>) => ({
        type: i.type ?? 'general',
        severity: i.severity ?? 'info',
        title: String(i.title),
        detail: String(i.detail),
        deepLink: i.deepLink ? String(i.deepLink) : undefined,
      }))

      await supabase.from('ai_insights').insert({
        user_id: userId,
        generated_at: new Date().toISOString(),
        period: 'last_90_days',
        insights: typed,
        model,
        token_count: tokenCount,
      })
      return { ok: true, insights: typed.length }
    } catch {
      return { ok: false, error: 'Malformed LLM response' }
    }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Unknown error' }
  }
}

/** Fetches AMFI's NAVAll.txt and upserts into nav_history. */
async function pullAmfiNav(supabase: ReturnType<typeof createSupabaseClient>): Promise<{ rows: number; date: string }> {
  const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', { headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`AMFI NAV fetch failed: ${res.status}`)
  const text = await res.text()

  // AMFI format is semicolon-separated:
  // Scheme Code;Scheme Name;ISIN Div Payout/ISIN Growth;ISIN Reinvestment;NAV;Date
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)
  let navDate = ''
  let inserted = 0

  const rows = lines.map((line) => line.trim().split(';'))
  // Figure out date from the last line that has a valid NAV date
  for (const parts of rows.slice().reverse()) {
    if (parts.length >= 6) {
      const rawDate = parts[5] ?? ''
      const m = rawDate.match(/(\d{2})-(\d{2})-(\d{4})/)
      if (m) {
        navDate = `${m[3]}-${m[2]}-${m[1]}`
        break
      }
    }
  }
  if (!navDate) navDate = new Date().toISOString().slice(0, 10)

  const navRows: Array<{ scheme_code: string; scheme_name: string; nav_value: number; nav_date: string }> = []
  for (const row of rows) {
    if (row.length < 6) continue
    const schemeCode = row[0]?.trim()
    const schemeName = row[1]?.trim()
    const navValueRaw = row[4]?.trim()
    if (!schemeCode || !schemeName || !navValueRaw) continue
    const navValue = Number(navValueRaw)
    if (Number.isNaN(navValue) || navValue <= 0) continue
    navRows.push({ scheme_code: schemeCode, scheme_name: schemeName, nav_value: navValue, nav_date: navDate })
  }

  // Upsert in chunks of 500 to avoid body-size limits
  for (let i = 0; i < navRows.length; i += 500) {
    const chunk = navRows.slice(i, i + 500)
    const { error } = await supabase
      .from('nav_history')
      .upsert(chunk, { onConflict: 'scheme_code,nav_date' })
    if (error) {
      console.error(`NAV chunk ${i} failed:`, error.message)
      throw error
    }
    inserted += chunk.length
  }

  return { rows: navRows.length, date: navDate }
}

/** Sends split reminder notifications for balances outstanding > N days. */
async function sendSplitReminders(supabase: ReturnType<typeof createSupabaseClient>): Promise<number> {
  // Find unsettled participants whose split group is open for > 7 days
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: groups } = await supabase
    .from('split_groups')
    .select('id, user_id, title, created_at, participants:split_participants(id, name, share_amount, is_settled)')
    .eq('is_closed', false)
    .lte('created_at', cutoff)

  let reminders = 0
  for (const group of (groups ?? []) as unknown as Array<{
    id: string
    user_id: string
    title: string
    created_at: string
    participants: Array<{ id: string; name: string; share_amount: number; is_settled: boolean }>
  }>) {
    const unsettled = group.participants?.filter((p) => !p.is_settled) ?? []
    if (unsettled.length === 0) continue

    const totalOwed = unsettled.reduce((sum, p) => sum + p.share_amount, 0)
    const { participants: _, ...rest } = group
    const { data: existingNotif } = await supabase
      .from('notifications')
      .select('id')
      .eq('user_id', group.user_id)
      .eq('type', 'split_reminder')
      .eq('payload->>group_id', String(group.id))
      .limit(1)

    if (existingNotif && existingNotif.length > 0) continue

    await supabase.from('notifications').insert({
      user_id: group.user_id,
      type: 'split_reminder',
      title: `₹${totalOwed.toLocaleString('en-IN')} still owed for "${group.title}"`,
      body: `${unsettled.length} participant${unsettled.length === 1 ? '' : 's'} haven't settled yet (open ${Math.floor((Date.now() - new Date(group.created_at).getTime()) / 86_400_000)} days). Tap to view.`,
      payload: { group_id: group.id },
      read: false,
    })
    reminders++
  }

  return reminders
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  // For cron use, an Authorization header with the service role is expected;
  // the actual pg_cron integration calls this with the service token.
  const authHeader = req.headers.get('Authorization')
  const expectedToken = Deno.env.get('CRON_SECRET')
  if (expectedToken && (!authHeader || !authHeader.includes(expectedToken))) {
    // Also allow in dev mode when CRON_SECRET is unset
    if (!Deno.env.get('CRON_SECRET')) {
      // fall through (dev mode)
    } else {
      return jsonResponse({ error: 'Unauthorized' }, 401)
    }
  }

  const supabase = createSupabaseClient()
  const results: Record<string, unknown> = {}

  // 1. Generate insights for active users
  try {
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .not('id', 'is', null)
      .limit(500)
    // "active" users are those who have at least one transaction in the last 90 days
    const activeUserIds: string[] = []
    for (const u of (users ?? []) as unknown as Array<{ id: string }>) {
      const { count } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', u.id)
        .gte('occurred_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
        .limit(1)
      if ((count ?? 0) > 0) activeUserIds.push(u.id)
    }

    const insightsResults = await Promise.all(activeUserIds.map((id) => generateInsightsForUser(supabase, id)))
    results.insights = {
      usersProcessed: activeUserIds.length,
      generated: insightsResults.filter((r) => r.ok && r.insights > 0).length,
      failed: insightsResults.filter((r) => !r.ok).length,
    }
  } catch (err) {
    results.insights = { error: err instanceof Error ? err.message : 'Failed' }
  }

  // 2. Pull AMFI NAVs
  try {
    const navResult = await pullAmfiNav(supabase)
    results.nav = navResult
  } catch (err) {
    results.nav = { error: err instanceof Error ? err.message : 'Failed' }
  }

  // 3. Split reminders
  try {
    const reminders = await sendSplitReminders(supabase)
    results.splitReminders = { sent: reminders }
  } catch (err) {
    results.splitReminders = { error: err instanceof Error ? err.message : 'Failed' }
  }

  return jsonResponse(results)
})