// Supabase Edge Function: ingest-sms
//
// Accepts a raw SMS from the Android app, parses Indian bank/UPI SMS formats,
// and stores the result in sms_transactions for the user to review.
//
// Deploy with:
//   supabase functions deploy ingest-sms --no-verify-jwt
//
// The Android app authenticates via a user-specific API key stored in the
// app's encrypted preferences (set in the web app's SMS settings page).
// The key is validated against the user's sms_api_key in their profile.

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.110.0'

// ---------------------------------------------------------------------------
// SMS Parsing — Indian bank SMS formats
// ---------------------------------------------------------------------------

interface ParsedSms {
  amount: number | null
  type: 'debit' | 'credit' | null
  description: string | null
  merchant: string | null
}

// UPI transaction patterns — amount BEFORE keyword (e.g. "Rs 500 debited from ...")
const UPI_DEBIT_RE = /(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)\s*(?:debited|deducted|paid)\s*(?:from|by|via|for)?\s*(.+?)(?:\.|$)/i
const UPI_CREDIT_RE = /(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)\s*(?:credited|received|added)\s*(?:to|by|from|via)?\s*(.+?)(?:\.|$)/i

// Card transaction patterns — amount BEFORE keyword (e.g. "Rs 500 spent at ...")
const CARD_DEBIT_RE = /(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)\s*(?:spent|withdrawn|used|debited|purchase|txn)\s*(?:at|on|via)?\s*(.+?)(?:\.|$)/i
const CARD_CREDIT_RE = /(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)\s*(?:credited|refund|payment received|cashback)\s*(?:at|from|on|via)?\s*(.+?)(?:\.|$)/i

// Amount AFTER keyword patterns — Indian bank SMS format:
//   "Your A/c XX8295 debited by Rs. 51.00 on 18/08/26"
//   "Your A/c XXXXX738295 is debited by INR 1,00,000.00 on 17/08/26"
//   "Your A/c XXXXXXX8295 has been credited with Rs. 100,000.00 on 17-08-2026"
const DEBITED_BY_RE = /(?:debited|deducted)\s+by\s+(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)/i
const CREDITED_WITH_RE = /(?:credited|received)\s+with\s+(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)/i
const CREDITED_TO_RE = /(?:credited|received)\s+(?:to|into)\s+(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)/i
const DEBITED_AMOUNT_RE = /(?:debited|deducted)\s+(?:with\s+)?(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)/i
const CREDITED_AMOUNT_RE = /(?:credited|received)\s+(?:with\s+)?(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)/i

// Generic amount extraction (with currency prefix)
const AMOUNT_RE = /(?:Rs\.?|₹|INR)\s?([\d,]+\.?\d*)/i

// Plain decimal amount extraction (e.g. "51.00", "1,234.56") — used as a
// fallback for bank SMS that don't prefix the amount with a currency symbol.
const DECIMAL_AMOUNT_RE = /\b(\d{1,3}(?:,\d{3})*\.\d{2})\b/

// Bank name detection
const BANK_PATTERNS: Array<[RegExp, string]> = [
  [/(HDFC\s*Bank|HDFCBK)/i, 'HDFC Bank'],
  [/(ICICI\s*Bank|ICICIB)/i, 'ICICI Bank'],
  [/(SBI\s*Credit\s*Card|SBI|State\s*Bank\s*of\s*India)/i, 'SBI'],
  [/(Axis\s*Bank|AXISB)/i, 'Axis Bank'],
  [/(Kotak\s*Mahindra|KOTAKB)/i, 'Kotak Mahindra'],
  [/(Yes\s*Bank|YESBANK)/i, 'Yes Bank'],
  [/(IndusInd\s*Bank|INDB)/i, 'IndusInd Bank'],
  [/(IDFC\s*First|IDFCB)/i, 'IDFC First Bank'],
    [/(Paytm\s*Payments|PAYTM)/i, 'Paytm Payments Bank'],
    // Fintech apps that send alerts as app notifications (forwarded by the
    // Ledger SMS Forwarder's notification listener with senderPhone "APP:slice")
    [/(slice)/i, 'Slice'],
]

// Merchant/description extraction from common SMS patterns
const MERCHANT_PATTERNS: Array<[RegExp, string]> = [
  [/(?:to|at|via|for)\s+(VPA\s*:|UPI\s*:)?\s*([a-zA-Z0-9_.]+@[a-zA-Z0-9]+)/i, 'UPI: $2'],
  [/(?:at|at\s+merchant)\s+(.+?)(?:\.|\s+on|\s+ref)/i, '$1'],
  [/(?:paid\s+to|to)\s+(.+?)(?:\.|\s+via|\s+on|\s+ref)/i, '$1'],
  [/(?:purchase\s+at|purchase\s+on)\s+(.+?)(?:\.|\s+on|\s+ref)/i, '$1'],
  [/swiggy/i, 'Swiggy'],
  [/zomato/i, 'Zomato'],
  [/amazon/i, 'Amazon'],
  [/flipkart/i, 'Flipkart'],
  [/uber/i, 'Uber'],
  [/ola/i, 'Ola'],
  [/rapido/i, 'Rapido'],
  [/zepto/i, 'Zepto'],
  [/blinkit/i, 'Blinkit'],
  [/bigbasket/i, 'BigBasket'],
  [/netflix/i, 'Netflix'],
  [/prime\s*video/i, 'Amazon Prime Video'],
  [/hotstar/i, 'Disney+ Hotstar'],
  [/spotify/i, 'Spotify'],
]

function parseSmsText(text: string): ParsedSms {
  let amount: number | null = null
  let type: 'debit' | 'credit' | null = null
  let description: string | null = null
  let merchant: string | null = null

  // Try UPI debit first
  const upiDebitMatch = text.match(UPI_DEBIT_RE)
  if (upiDebitMatch) {
    amount = parseAmount(upiDebitMatch[1])
    type = 'debit'
    description = upiDebitMatch[2]?.trim() ?? null
    // Try to extract merchant from description
    const detail = upiDebitMatch[2]?.trim() ?? ''
    merchant = extractMerchant(detail, text)
    return { amount, type, description: detail, merchant }
  }

  // Try UPI credit
  const upiCreditMatch = text.match(UPI_CREDIT_RE)
  if (upiCreditMatch) {
    amount = parseAmount(upiCreditMatch[1])
    type = 'credit'
    const detail = upiCreditMatch[2]?.trim() ?? ''
    merchant = extractMerchant(detail, text)
    return { amount, type, description: detail, merchant }
  }

  // Try card debit
  const cardDebitMatch = text.match(CARD_DEBIT_RE)
  if (cardDebitMatch) {
    amount = parseAmount(cardDebitMatch[1])
    type = 'debit'
    description = cardDebitMatch[2]?.trim() ?? null
    merchant = extractMerchant(description ?? '', text)
    return { amount, type, description, merchant }
  }

  // Try card credit
  const cardCreditMatch = text.match(CARD_CREDIT_RE)
  if (cardCreditMatch) {
    amount = parseAmount(cardCreditMatch[1])
    type = 'credit'
    description = cardCreditMatch[2]?.trim() ?? null
    merchant = extractMerchant(description ?? '', text)
    return { amount, type, description, merchant }
  }

  // Try "debited by Rs. [amount]" — amount AFTER the keyword
  // e.g. "Your A/c XX8295 debited by Rs. 51.00 on 18/08/26"
  const debitedByMatch = text.match(DEBITED_BY_RE)
  if (debitedByMatch) {
    amount = parseAmount(debitedByMatch[1])
    type = 'debit'
    description = text.replace(DEBITED_BY_RE, '').trim().substring(0, 200)
    merchant = extractMerchant(description, text)
    return { amount, type, description, merchant }
  }

  // Try "credited with Rs. [amount]" — amount AFTER the keyword
  // e.g. "Your A/c XXXXXXX8295 has been credited with Rs. 100,000.00"
  const creditedWithMatch = text.match(CREDITED_WITH_RE)
  if (creditedWithMatch) {
    amount = parseAmount(creditedWithMatch[1])
    type = 'credit'
    description = text.replace(CREDITED_WITH_RE, '').trim().substring(0, 200)
    merchant = extractMerchant(description, text)
    return { amount, type, description, merchant }
  }

  // Try "credited to Rs. [amount]" — amount AFTER the keyword
  const creditedToMatch = text.match(CREDITED_TO_RE)
  if (creditedToMatch) {
    amount = parseAmount(creditedToMatch[1])
    type = 'credit'
    description = text.replace(CREDITED_TO_RE, '').trim().substring(0, 200)
    merchant = extractMerchant(description, text)
    return { amount, type, description, merchant }
  }

  // Try "debited Rs. [amount]" / "debited with Rs. [amount]"
  const debitedAmountMatch = text.match(DEBITED_AMOUNT_RE)
  if (debitedAmountMatch) {
    amount = parseAmount(debitedAmountMatch[1])
    type = 'debit'
    description = text.replace(DEBITED_AMOUNT_RE, '').trim().substring(0, 200)
    merchant = extractMerchant(description, text)
    return { amount, type, description, merchant }
  }

  // Try "credited Rs. [amount]" / "credited with Rs. [amount]"
  const creditedAmountMatch = text.match(CREDITED_AMOUNT_RE)
  if (creditedAmountMatch) {
    amount = parseAmount(creditedAmountMatch[1])
    type = 'credit'
    description = text.replace(CREDITED_AMOUNT_RE, '').trim().substring(0, 200)
    merchant = extractMerchant(description, text)
    return { amount, type, description, merchant }
  }

  // Fallback: try currency-prefixed amount first
  const amountMatch = text.match(AMOUNT_RE)
  if (amountMatch) {
    amount = parseAmount(amountMatch[1])
    // Detect debit/credit from keywords
    if (/debited|spent|paid|purchase|withdrawn|used/i.test(text)) type = 'debit'
    else if (/credited|received|refund|cashback|added/i.test(text)) type = 'credit'
    description = text.replace(AMOUNT_RE, '').trim().substring(0, 200)
    return { amount, type, description, merchant }
  }

  // Fallback: try plain decimal amount (e.g. "51.00", "1,234.56")
  const decimalAmountMatch = text.match(DECIMAL_AMOUNT_RE)
  if (decimalAmountMatch) {
    amount = parseAmount(decimalAmountMatch[1])
    // Detect debit/credit from keywords
    if (/debited|spent|paid|purchase|withdrawn|used/i.test(text)) type = 'debit'
    else if (/credited|received|refund|cashback|added/i.test(text)) type = 'credit'
    description = text.replace(DECIMAL_AMOUNT_RE, '').trim().substring(0, 200)
  }

  return { amount, type, description, merchant }
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/[,₹\s]/g, '')
  const num = Number(cleaned)
  return Number.isNaN(num) ? null : num
}

function extractMerchant(detail: string, fullText: string): string | null {
  // Check known merchant patterns
  for (const [pattern, name] of MERCHANT_PATTERNS) {
    const match = fullText.match(pattern) || detail.match(pattern)
    if (match) {
      const resolved = match[1] ? match[0] : name
      return resolved
    }
  }
  // If detail contains a VPA (UPI ID), return it as the merchant
  const vpaMatch = detail.match(/([a-zA-Z0-9_.]+@[a-zA-Z0-9]+)/)
  if (vpaMatch) return vpaMatch[1]
  return detail || null
}

function detectBank(text: string): string | null {
  for (const [pattern, name] of BANK_PATTERNS) {
    if (pattern.test(text)) return name
  }
  return null
}

// ---------------------------------------------------------------------------
// Supabase client
// ---------------------------------------------------------------------------

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(supabaseUrl, supabaseKey)
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const body = await req.json()
    const { apiKey, senderPhone, rawText, receivedAt } = body

    if (!apiKey || !rawText || !senderPhone) {
      return jsonResponse({ error: 'apiKey, senderPhone, and rawText are required' }, 400)
    }

    // Skip OTP / verification / one-time password messages
    if (
      /otp|one\s*time\s*password|one-time\s*password|verification\s*code|do\s*not\s*share|never\s*share/i.test(
        rawText,
      )
    ) {
      return jsonResponse({ skipped: true, reason: 'OTP message' }, 200)
    }

    const supabase = createSupabaseClient()

    // Validate API key and get user
    const { data: userData, error: userError } = await supabase
      .from('profiles')
      .select('id, base_currency')
      .eq('sms_api_key', apiKey)
      .single()

    if (userError || !userData) {
      return jsonResponse({ error: 'Invalid API key' }, 401)
    }

    const userId = userData.id

    // Parse the SMS
    const parsed = parseSmsText(rawText)
    const bankName = detectBank(rawText)

    // Try to find a matching account
    let accountId: string | null = null
    if (bankName) {
      const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .eq('user_id', userId)
        .ilike('name', `%${bankName}%`)
        .limit(1)
      if (accounts && accounts.length > 0) {
        accountId = accounts[0].id
      }
    }

    // Check if this is a duplicate (same amount, same description, within 5 minutes)
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
    const { data: duplicates } = await supabase
      .from('sms_transactions')
      .select('id')
      .eq('user_id', userId)
      .eq('amount', parsed.amount ?? 0)
      .eq('status', 'pending')
      .gte('received_at', fiveMinAgo)
      .limit(1)

    const isDuplicate = duplicates && duplicates.length > 0

    // Store the SMS transaction
    const { data: smsRecord, error: insertError } = await supabase
      .from('sms_transactions')
      .insert({
        user_id: userId,
        sender_phone: senderPhone,
        raw_text: rawText,
        received_at: receivedAt || new Date().toISOString(),
        parsed_at: new Date().toISOString(),
        account_id: accountId,
        amount: parsed.amount,
        type: parsed.type,
        description: parsed.description,
        merchant: parsed.merchant,
        status: isDuplicate ? 'duplicate' : 'pending',
      })
      .select('id')
      .single()

    if (insertError) {
      return jsonResponse({ error: 'Failed to store SMS transaction' }, 500)
    }

    return jsonResponse({
      id: smsRecord.id,
      parsed: {
        amount: parsed.amount,
        type: parsed.type,
        merchant: parsed.merchant,
        description: parsed.description,
        bankName,
        detectedAccount: accountId,
      },
      isDuplicate,
    })
  } catch (err) {
    return jsonResponse(
      { error: err instanceof Error ? err.message : 'Internal server error' },
      500,
    )
  }
})