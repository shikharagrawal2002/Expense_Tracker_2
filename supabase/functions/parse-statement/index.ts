// Supabase Edge Function: parse-statement
//
// Accepts a bank or credit-card statement file (CSV, XLS/XLSX, or PDF), extracts
// a normalized transaction list, and — for credit cards — a due-date/bill-amount
// summary. Returns everything for review in the UI; nothing is written to the
// database here (the client inserts rows only after the user confirms them).
//
// Deploy with:
//   supabase functions deploy parse-statement
//
// Required secrets (set automatically for you on Supabase-hosted projects):
//   SUPABASE_URL, SUPABASE_ANON_KEY
// Some npm dependencies (xlsx, and unpdf's pdf.js internals) assume `Buffer`
// exists as a Node-style global, even though this runtime doesn't provide one
// automatically the way Node does. Without this, those libraries throw
// "Buffer is not defined" the moment they touch binary data. This must run
// before any other import below, in case a dependency touches Buffer at its
// own module-load time rather than only when actually invoked.
import { Buffer } from 'node:buffer'
// @ts-ignore -- intentionally patching the global for dependencies that expect it
globalThis.Buffer = Buffer

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { extractContent } from './lib/extract-rows.ts'
import { parseBankStatement } from './lib/bank-parsers.ts'
import { parseCardStatement } from './lib/card-parsers.ts'
import { flagDuplicates } from './lib/dedupe.ts'
import type { ParseRequestBody, ParseResult } from './lib/types.ts'

function decodeBase64(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  let body: ParseRequestBody
  try {
    body = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const { kind, fileName, mimeType, fileBase64, accountId } = body
  if (!kind || !fileName || !fileBase64 || !accountId) {
    return jsonResponse(
      { error: 'kind, fileName, fileBase64, and accountId are all required' },
      400,
    )
  }
  if (kind !== 'bank' && kind !== 'card') {
    return jsonResponse({ error: 'kind must be "bank" or "card"' }, 400)
  }

  const warnings: string[] = []

  try {
    const bytes = decodeBase64(fileBase64)
    const content = await extractContent(fileName, mimeType || '', bytes)

    let result: ParseResult
    if (kind === 'bank') {
      const transactions = parseBankStatement(content, warnings)
      result = { transactions, warnings }
    } else {
      const { transactions, summary } = parseCardStatement(content, warnings)
      result = { transactions, cardSummary: summary, warnings }
    }

    result.transactions = await flagDuplicates(
      req.headers.get('Authorization'),
      accountId,
      result.transactions,
    )

    if (result.transactions.length === 0 && warnings.length === 0) {
      warnings.push('No transactions could be extracted from this file.')
      result.warnings = warnings
    }

    return jsonResponse(result)
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Failed to parse statement' },
      422,
    )
  }
})
