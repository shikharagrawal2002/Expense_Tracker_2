// Cloudflare Workers AI fallback parser for SMS transaction text.
//
// Only invoked when the deterministic regex parser fails to extract an
// amount or type from the raw SMS. Uses Cloudflare's privacy-focused
// Workers AI endpoint with the free-tier Llama model.
//
// Env vars required when fallback AI is used:
//   CLOUDFLARE_ACCOUNT_ID
//   CLOUDFLARE_API_TOKEN

// @ts-nocheck — edge functions run in Deno; the DOM/browser TS context
// doesn't know the Deno namespace.

const MODEL = '@cf/meta/llama-3.3-70b-instruct'

export interface AiParsedSms {
  amount: number | null
  type: 'debit' | 'credit' | null
  description: string | null
  merchant: string | null
  bankName: string | null
}

const SYSTEM_PROMPT = `You are a financial SMS parser for Indian bank/UPI/card transaction messages.
Parse the given raw SMS and return ONLY valid JSON with this exact shape:
{
  "amount": <number or null>,
  "type": "debit" | "credit" | null,
  "merchant": "<string or null>",
  "description": "<short clean description or null>",
  "bankName": "<known Indian bank name or null>"
}

Rules:
- amount is always positive and in INR.
- type debit = money went out (debited, paid, spent, withdrawn, purchased).
- type credit = money came in (credited, received, refund, cashback, added).
- merchant = the payee/business name if identifiable, else null.
- description = brief summary of the transaction, max 120 chars. Remove OTP/verification code references.
- bankName: match one of HDFC Bank, ICICI Bank, SBI, Axis Bank, Kotak Mahindra, Yes Bank, IndusInd Bank, IDFC First Bank, HSBC Bank, Paytm Payments Bank, Slice. Null if unknown.
- If the transaction cannot be understood, return {"amount":null,"type":null,"merchant":null,"description":null,"bankName":null}`

/**
 * Asks Cloudflare Workers AI to parse an SMS that the regex parser missed.
 * Returns null if the model call fails — the caller falls back gracefully.
 */
export async function aiParseSms(rawText: string): Promise<AiParsedSms | null> {
  const accountId = Deno.env.get('CLOUDFLARE_ACCOUNT_ID')
  const apiToken = Deno.env.get('CLOUDFLARE_API_TOKEN')
  if (!accountId || !apiToken) return null

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${MODEL}`

  const body = JSON.stringify({
    messages: [
      { role: 'system', content: SYSTEM_PROMPT },
      { role: 'user', content: `Raw SMS:\n${rawText}` },
    ],
    max_tokens: 256,
    temperature: 0,
  })

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10_000)
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body,
      signal: controller.signal,
    })
    clearTimeout(timeout)

    if (!resp.ok) return null

    const json = (await resp.json()) as {
      result?: { response?: string }
    }
    const text = json.result?.response ?? ''
    if (!text) return null

    return parseAiResponse(text)
  } catch {
    return null
  }
}

/**
 * Extracts the JSON payload from the model's response. The model may wrap
 * JSON in markdown code fences or add prose; we find the first {...} block.
 */
function parseAiResponse(text: string): AiParsedSms | null {
  const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidate = fenceMatch ? fenceMatch[1] : text

  const braceStart = candidate.indexOf('{')
  const braceEnd = candidate.lastIndexOf('}')
  if (braceStart === -1 || braceEnd === -1 || braceEnd <= braceStart) return null

  try {
    const obj = JSON.parse(candidate.slice(braceStart, braceEnd + 1)) as Partial<AiParsedSms>
    const amount =
      typeof obj.amount === 'number' && !Number.isNaN(obj.amount) ? obj.amount : null
    const type = obj.type === 'debit' || obj.type === 'credit' ? obj.type : null
    return {
      amount,
      type,
      merchant: typeof obj.merchant === 'string' && obj.merchant.trim() ? obj.merchant.trim() : null,
      description: typeof obj.description === 'string' && obj.description.trim() ? obj.description.trim() : null,
      bankName: typeof obj.bankName === 'string' && obj.bankName.trim() ? obj.bankName.trim() : null,
    }
  } catch {
    return null
  }
}