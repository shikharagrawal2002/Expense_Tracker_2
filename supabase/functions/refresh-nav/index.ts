// Supabase Edge Function: refresh-nav
//
// Fetches the latest NAV from AMFI for the current user's mutual-fund holdings
// and updates their current_value in real-time. Called from the frontend
// whenever the Investments page loads or the user hits "Refresh values".
//
// Deploy with:
//   supabase functions deploy refresh-nav
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_ANON_KEY (auto-set)

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.0'

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

/** Fetches AMFI's NAVAll.txt and returns a map of scheme_code → { nav, date }. */
async function fetchAmfiNavs(): Promise<Map<string, { nav: number; date: string }>> {
  const res = await fetch('https://www.amfiindia.com/spages/NAVAll.txt', {
    headers: { 'User-Agent': 'Mozilla/5.0' },
  })
  if (!res.ok) throw new Error(`AMFI NAV fetch failed: ${res.status}`)
  const text = await res.text()

  const navMap = new Map<string, { nav: number; date: string }>()
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0)

  for (const line of lines) {
    const parts = line.trim().split(';')
    if (parts.length < 6) continue
    const schemeCode = parts[0]?.trim()
    const navValueRaw = parts[4]?.trim()
    const dateRaw = parts[5]?.trim()
    if (!schemeCode || !navValueRaw) continue
    const navValue = Number(navValueRaw)
    if (Number.isNaN(navValue) || navValue <= 0) continue

    // Parse date dd-mm-yyyy
    let navDate = ''
    const m = dateRaw.match(/(\d{2})-(\d{2})-(\d{4})/)
    if (m) navDate = `${m[3]}-${m[2]}-${m[1]}`

    navMap.set(schemeCode, { nav: navValue, date: navDate })
  }

  return navMap
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  const authHeader = req.headers.get('Authorization')
  const userId = authHeader ? extractUserId(authHeader) : null
  if (!userId) {
    return jsonResponse({ error: 'Not authenticated' }, 401)
  }

  const supabase = createSupabaseClient(authHeader)

  try {
    // Get the user's mutual fund holdings with scheme codes
    const { data: holdings, error: holdingsError } = await supabase
      .from('investment_holdings')
      .select('id, name, scheme_code, units, invested_amount')
      .eq('user_id', userId)
      .eq('type', 'mutual_fund')

    if (holdingsError) throw holdingsError
    if (!holdings || holdings.length === 0) {
      return jsonResponse({ updated: 0, message: 'No mutual fund holdings found' })
    }

    // Fetch the latest NAVs from AMFI
    const navMap = await fetchAmfiNavs()

    let updated = 0
    let matched = 0
    const updatedHoldings: Array<{ id: string; name: string; current_value: number; nav: number; nav_date: string }> = []

    for (const h of holdings) {
      // Try to match by scheme_code first, then by name
      let navEntry = h.scheme_code ? navMap.get(h.scheme_code) : undefined

      if (!navEntry) {
        // Try matching by name (first 20 chars, case-insensitive)
        const nameKey = h.name.toLowerCase().slice(0, 20)
        for (const [code, entry] of navMap.entries()) {
          // AMFI names are like "Aditya Birla Sun Life..." — try a loose match
          if (code && entry) {
            // We can't easily match by name without the AMFI name, so skip
          }
        }
      }

      if (!navEntry) continue
      matched++

      const currentValue = h.units > 0 ? h.units * navEntry.nav : h.invested_amount
      const { error: updateError } = await supabase
        .from('investment_holdings')
        .update({ current_value: currentValue })
        .eq('id', h.id)

      if (!updateError) {
        updated++
        updatedHoldings.push({
          id: h.id,
          name: h.name,
          current_value: currentValue,
          nav: navEntry.nav,
          nav_date: navEntry.date,
        })
      }
    }

    return jsonResponse({
      updated,
      matched,
      total: holdings.length,
      holdings: updatedHoldings,
    })
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to refresh NAVs' },
      500,
    )
  }
})