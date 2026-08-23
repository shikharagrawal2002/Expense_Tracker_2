// Supabase Edge Function: parse-portfolio
//
// Parses Groww mutual-fund exports (Holdings XLSX/CSV, Transaction XLSX/CSV,
// or Capital-gains PDF, including password-protected PDFs) and upserts the
// user's investment holdings + full buy/SIP/redemption history.
//
// Deploy with:
//   supabase functions deploy parse-portfolio
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY (auto-set), STATEMENT_PASSWORD_KEY (optional)

import { Buffer } from 'node:buffer'
// @ts-ignore -- patch Buffer global for dependencies that expect it
globalThis.Buffer = Buffer

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { extractContent } from './lib/extract-rows.ts'
import { parseGrowwHoldings, parseGrowwTransactions, type GrowwHolding, type GrowwTransaction } from './lib/groww-parser.ts'
import { decryptPassword } from './lib/password-crypto.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.0'

interface ParsePortfolioRequest {
  /** 'holdings' | 'transactions' | 'capital-gains' — auto-detected when omitted */
  reportType?: 'holdings' | 'transactions' | 'capital-gains'
  fileName: string
  mimeType: string
  fileBase64: string
  /** Optional password for locked PDFs/Excel files */
  password?: string
}

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

function createSupabaseClient(authHeader?: string | null) {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) {
    throw new Error('SUPABASE_URL and SUPABASE_ANON_KEY are required')
  }
  return createClient(supabaseUrl, anonKey, {
    global: { headers: authHeader ? { Authorization: authHeader } : undefined },
  })
}

function extractUserId(authHeader: string): string | null {
  try {
    const token = authHeader.replace(/^Bearer\s+/i, '')
    const payload = JSON.parse(atob(token.split('.')[1]))
    return payload.sub ?? null
  } catch {
    return null
  }
}

/** Matches a holding by ISIN first, then scheme code, then normalized name. */
async function findHolding(
  supabase: ReturnType<typeof createSupabaseClient>,
  userId: string,
  h: GrowwHolding,
): Promise<string | null> {
  if (h.isin) {
    const { data } = await supabase
      .from('investment_holdings')
      .select('id')
      .eq('user_id', userId)
      .eq('isin', h.isin)
      .maybeSingle()
    if (data) return data.id
  }
  if (h.schemeCode) {
    const { data } = await supabase
      .from('investment_holdings')
      .select('id')
      .eq('user_id', userId)
      .eq('scheme_code', h.schemeCode)
      .maybeSingle()
    if (data) return data.id
  }

  // Fall back to a name match (case-insensitive)
  const { data } = await supabase
    .from('investment_holdings')
    .select('id')
    .eq('user_id', userId)
    .ilike('name', `%${h.schemeName.slice(0, 20)}%`)
    .limit(1)
  return data?.[0]?.id ?? null
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: ParsePortfolioRequest
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { reportType, fileName, mimeType, fileBase64, password } = body
  if (!fileName || !fileBase64) {
    return jsonResponse({ error: 'fileName and fileBase64 are required' }, 400)
  }

  const authHeader = req.headers.get('Authorization')
  const userId = authHeader ? extractUserId(authHeader) : null
  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  const supabase = createSupabaseClient(authHeader)

  try {
    // Resolve stored password if none provided
    let resolvedPassword = password ?? ''
    if (!resolvedPassword) {
      const { data: saved } = await supabase
        .from('statement_passwords')
        .select('encrypted_password')
        .eq('user_id', userId)
        .eq('bank', 'groww')
        .single()
      if (saved?.encrypted_password) {
        const decrypted = await decryptPassword(saved.encrypted_password)
        if (decrypted) resolvedPassword = decrypted
      }
    }

    const bytes = decodeBase64(fileBase64)
    const content = await extractContent(fileName, mimeType || '', bytes, resolvedPassword)

    // Auto-detect report type from filename when not specified
    const lowerName = fileName.toLowerCase()
    const effectiveReportType: ParsePortfolioRequest['reportType'] = reportType ??
      (lowerName.includes('transaction')
        ? 'transactions'
        : lowerName.includes('capital')
          ? 'capital-gains'
          : 'holdings')

    if (effectiveReportType === 'transactions' || effectiveReportType === 'capital-gains') {
      const transactions = parseGrowwTransactions(content)
      let inserted = 0
      let updated = 0

      for (const txn of transactions) {
        // Find or create the holding from the transaction's scheme
        let holdingId = await findHolding(supabase, userId, {
          schemeName: txn.schemeName,
          isin: txn.isin,
          schemeCode: txn.schemeCode,
          units: 0,
          investedAmount: 0,
          currentValue: 0,
        })

        if (!holdingId) {
          const { data: newHolding } = await supabase
            .from('investment_holdings')
            .insert({
              user_id: userId,
              name: txn.schemeName,
              type: 'mutual_fund',
              isin: txn.isin ?? null,
              scheme_code: txn.schemeCode ?? null,
              current_value: 0,
              invested_amount: 0,
              risk_level: 'medium',
            })
            .select('id')
            .single()
          if (newHolding) {
            holdingId = newHolding.id
            updated++
          }
        }

        if (!holdingId) continue

        // Upsert the transaction (dedupe by external_ref)
        const { error: txError } = await supabase
          .from('investment_transactions')
          .upsert({
            user_id: userId,
            holding_id: holdingId,
            type: txn.type,
            units: txn.units,
            nav: txn.nav,
            amount: txn.amount,
            transaction_date: txn.date,
            scheme_code: txn.schemeCode ?? null,
            isin: txn.isin ?? null,
            source: 'groww',
            external_ref: `groww:${txn.date}:${txn.schemeCode}:${txn.units}:${txn.amount}`,
          }, { onConflict: 'user_id,external_ref' })
        if (!txError) inserted++
      }

      // Recompute holding aggregates (units, average_cost, invested, current)
      await supabase.rpc('recalculate_holding_metrics', { p_user_id: userId })

      return jsonResponse({
        reportType: effectiveReportType,
        transactionsDetected: transactions.length,
        inserted,
        updated,
      })
    }

    // Holdings report
    const holdings = parseGrowwHoldings(content)
    let matched = 0
    let created = 0
    let updated = 0

    for (const h of holdings) {
      const existingId = await findHolding(supabase, userId, h)
      if (existingId) {
        // Update the existing holding with fresh units/values from the export
        const { error } = await supabase
          .from('investment_holdings')
          .update({
            units: h.units,
            average_cost: h.averageCost,
            invested_amount: h.investedAmount,
            current_value: h.currentValue,
            isin: h.isin ?? null,
            scheme_code: h.schemeCode ?? null,
          })
          .eq('id', existingId)
        if (!error) updated++
        matched++
      } else {
        const { error } = await supabase
          .from('investment_holdings')
          .insert({
            user_id: userId,
            name: h.schemeName,
            type: 'mutual_fund',
            isin: h.isin ?? null,
            scheme_code: h.schemeCode ?? null,
            units: h.units,
            average_cost: h.averageCost,
            invested_amount: h.investedAmount,
            current_value: h.currentValue,
            risk_level: 'medium',
          })
        if (!error) created++
        updated++
      }
    }

    // Recompute holding aggregates from the imported data
    await supabase.rpc('recalculate_holding_metrics', { p_user_id: userId })

    return jsonResponse({
      reportType: effectiveReportType,
      holdingsDetected: holdings.length,
      matched,
      created,
      updated,
    })
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to parse portfolio' },
      422,
    )
  }
})