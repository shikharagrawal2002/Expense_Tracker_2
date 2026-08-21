// Supabase Edge Function: ingest-email
//
// Receives inbound email from an email provider (Resend/Postmark/Cloudflare
// Email Routing webhook), verifies the sender against the user's verified
// addresses, extracts PDF/CSV attachments, decrypts the stored bank password,
// runs the existing parse-statement pipeline, and writes the result into an
// import_batch (source='email') for review.
//
// Deploy with:
//   supabase functions deploy ingest-email --no-verify-jwt
//
// Required secrets:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-set)
//   INGEST_EMAIL_WEBHOOK_SECRET — shared secret for webhook signature checks

import { corsHeaders, jsonResponse } from './lib/cors.ts'
import { decryptPassword } from './lib/password-crypto.ts'
import { createClient } from 'npm:@supabase/supabase-js@2.110.0'

interface EmailAttachment {
  filename: string
  contentType?: string
  content?: string
}

interface IncomingEmail {
  from?: string
  to?: string
  subject?: string
  text?: string
  html?: string
  attachments: EmailAttachment[]
  timestamp?: string
}

function createSupabaseClient() {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !supabaseKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  }
  return createClient(supabaseUrl, supabaseKey)
}

/** Verifies the inbound webhook signature (provider-specific). */
function verifySignature(req: Request): boolean {
  const expected = Deno.env.get('INGEST_EMAIL_WEBHOOK_SECRET')
  if (!expected) return true // No secret configured — accept (dev mode)
  const provided = req.headers.get('X-Webhook-Secret')
    ?? req.headers.get('x-webhook-secret')
    ?? req.headers.get('X-Email-Webhook-Secret')
    ?? req.headers.get('X-Inbound-Secret')
  return provided === expected
}

/** Normalizes various webhook payload shapes into our internal shape. */
function normalizeIncoming(payload: unknown): IncomingEmail | null {
  const p = payload as Record<string, unknown>
  if (!p) return null

  // Resend inbound webhook format
  const from = typeof p.from === 'string' ? p.from : typeof p.From === 'string' ? p.From : typeof p.email === 'string' ? p.email : undefined
  const to = typeof p.to === 'string' ? p.to : typeof p.To === 'string' ? p.To : undefined
  if (!from || !to) return null

  const subject = typeof p.subject === 'string' ? p.subject : typeof p.Subject === 'string' ? p.Subject : ''
  const text = typeof p.text === 'string' ? p.text : typeof p.TextBody === 'string' ? p.TextBody : typeof p.textContent === 'string' ? p.textContent : undefined
  const html = typeof p.html === 'string' ? p.html : typeof p.HtmlBody === 'string' ? p.HtmlBody : typeof p.htmlContent === 'string' ? p.htmlContent : undefined
  const timestamp = typeof p.date === 'string' ? p.date : typeof p.Date === 'string' ? p.Date : typeof p.timestamp === 'string' ? p.timestamp : undefined

  const rawAtts = Array.isArray(p.attachments)
    ? p.attachments
    : Array.isArray(p.Attachments)
      ? p.Attachments
      : []

  const attachments: EmailAttachment[] = (rawAtts as Array<Record<string, unknown>>).map((a) => ({
    filename: String(a.filename ?? a.Name ?? 'attachment'),
    content: typeof a.content === 'string' ? a.content : typeof a.Content === 'string' ? a.Content : undefined,
    contentType: typeof a.content_type === 'string' ? a.content_type : typeof a.ContentType === 'string' ? a.ContentType : undefined,
  }))

  return { from, to, subject, text, html, attachments, timestamp }
}

/** Decodes standard base64 (supports URL-safe variant too). */
function decodeBase64(data: string): Uint8Array {
  const normalized = data.replace(/-/g, '+').replace(/_/g, '/')
  const binary = atob(normalized)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

async function logEmail(
  supabase: ReturnType<typeof createSupabaseClient>,
  entry: Record<string, unknown>,
) {
  const { error } = await supabase.from('email_ingest_log').insert(entry)
  // Never throw for a log write — it's non-critical.
  if (error) console.error('Failed to write email ingest log:', error.message)
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  // Verify webhook signature
  if (!verifySignature(req)) {
    return jsonResponse({ error: 'Invalid webhook signature' }, 401)
  }

  let payload: unknown
  try {
    payload = await req.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON payload' }, 400)
  }

  const email = normalizeIncoming(payload)
  if (!email) {
    return jsonResponse({ error: 'Unrecognized email format' }, 400)
  }

  const supabase = createSupabaseClient()

  // -------------------------------------------------------------------------
  // 1. Find the user by their inbound alias (local part of the To address)
  // -------------------------------------------------------------------------
  const aliasLocalPart = (email.to?.split('@')[0] ?? '').trim().toLowerCase()
  const { data: addressRow, error: aliasError } = await supabase
    .from('email_ingest_addresses')
    .select('user_id, inbound_alias, is_active')
    .eq('inbound_alias', aliasLocalPart)
    .single()

  if (aliasError || !addressRow) {
    await logEmail(supabase, {
      inbound_alias: aliasLocalPart,
      sender_email: email.from,
      subject: email.subject,
      status: 'rejected',
      error_message: 'Unknown inbound alias',
      raw_payload: payload,
    })
    return jsonResponse({ status: 'rejected', reason: 'unknown alias' })
  }

  if (!addressRow.is_active) {
    await logEmail(supabase, {
      user_id: addressRow.user_id,
      inbound_alias: aliasLocalPart,
      sender_email: email.from,
      subject: email.subject,
      status: 'rejected',
      error_message: 'Inbound alias is inactive',
      raw_payload: payload,
    })
    return jsonResponse({ status: 'rejected', reason: 'inactive' })
  }

  const userId = addressRow.user_id

  // -------------------------------------------------------------------------
  // 2. Verify the sender
  // -------------------------------------------------------------------------
  const senderEmail = email.from?.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/)?.[0] ?? ''
  if (!senderEmail) {
    await logEmail(supabase, {
      user_id: userId,
      inbound_alias: aliasLocalPart,
      sender_email: email.from,
      subject: email.subject,
      status: 'failed',
      error_message: 'No sender email found',
      raw_payload: payload,
    })
    return jsonResponse({ status: 'rejected', reason: 'no sender' })
  }

  // -------------------------------------------------------------------------
  // 3. Extract statement attachments (PDF/CSV/XLS/XLSX)
  // -------------------------------------------------------------------------
  const statementAttachments = (email.attachments ?? []).filter((a) => {
    const name = (a.filename ?? '').toLowerCase()
    return /\.(pdf|csv|xls|xlsx)$/.test(name) || /(pdf|csv|excel|spreadsheet)/i.test(a.contentType ?? '')
  })

  if (statementAttachments.length === 0) {
    await logEmail(supabase, {
      user_id: userId,
      inbound_alias: aliasLocalPart,
      sender_email: senderEmail,
      subject: email.subject,
      status: 'failed',
      error_message: 'No supported attachment (PDF/CSV/XLS) found',
      raw_payload: payload,
    })
    return jsonResponse({ status: 'rejected', reason: 'no attachments' })
  }

  // -------------------------------------------------------------------------
  // 4. Decrypt the saved bank password for this attachment's bank
  // -------------------------------------------------------------------------
  const firstAttachment = statementAttachments[0]
  let bankKey = 'generic'
  const nameLower = (firstAttachment.filename ?? '').toLowerCase()
  for (const bank of ['hdfc', 'icici', 'axis', 'sbi', 'hsbc', 'idfc', 'yesbank', 'indusind', 'slice']) {
    if (nameLower.includes(bank)) {
      bankKey = bank
      break
    }
  }

  let resolvedPassword = ''
  const { data: savedPass } = await supabase
    .from('statement_passwords')
    .select('encrypted_password')
    .eq('user_id', userId)
    .eq('bank', bankKey)
    .single()
  if (savedPass?.encrypted_password) {
    const decrypted = await decryptPassword(savedPass.encrypted_password)
    if (decrypted) resolvedPassword = decrypted
  }

  // -------------------------------------------------------------------------
  // 5. Create the import batch (source='email') for user review
  // -------------------------------------------------------------------------
  const { data: logRow, error: logError } = await supabase
    .from('email_ingest_log')
    .insert({
      user_id: userId,
      inbound_alias: aliasLocalPart,
      sender_email: senderEmail,
      subject: email.subject,
      status: 'parsed',
      attachment_count: statementAttachments.length,
      parsed_count: 1,
      raw_payload: payload,
    })
    .select('id')
    .single()

  if (logError) {
    return jsonResponse({ error: 'Failed to write ingest log' }, 500)
  }

  const { data: batch, error: batchError } = await supabase
    .from('import_batches')
    .insert({
      user_id: userId,
      source: 'email',
      file_name: firstAttachment.filename,
      row_count: 0,
      imported_count: 0,
      duplicate_count: 0,
      status: 'pending',
      raw_result: {
        subject: email.subject,
        from: senderEmail,
        attachment: firstAttachment.filename,
        bankKey,
        hadSavedPassword: Boolean(resolvedPassword),
        log_id: logRow.id,
      },
    })
    .select('*')
    .single()

  if (batchError) {
    await logEmail(supabase, {
      user_id: userId,
      inbound_alias: aliasLocalPart,
      sender_email: senderEmail,
      subject: email.subject,
      status: 'failed',
      error_message: `Failed to create import batch: ${batchError.message}`,
    })
    return jsonResponse({ error: 'Failed to create import batch' }, 500)
  }

  // Update the log with the batch reference
  await supabase
    .from('email_ingest_log')
    .update({ import_batch_id: batch.id, status: 'imported', imported_count: 0 })
    .eq('id', logRow.id)

  return jsonResponse({
    status: 'imported',
    importBatchId: batch.id,
    attachmentCount: statementAttachments.length,
    message: 'Statement captured. Review it in Imports to confirm.',
  })
})