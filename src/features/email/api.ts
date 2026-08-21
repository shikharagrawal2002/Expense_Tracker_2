import { supabase } from '@/lib/supabase/client'

export interface EmailIngestAddress {
  id: string
  user_id: string
  inbound_alias: string
  verified_at: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

export interface EmailIngestLogRow {
  id: string
  user_id: string | null
  inbound_alias: string | null
  sender_email: string | null
  subject: string | null
  status: string
  error_message: string | null
  attachment_count: number | null
  parsed_count: number | null
  imported_count: number | null
  import_batch_id: string | null
  created_at: string
}

const INBOUND_DOMAIN = import.meta.env.VITE_INBOUND_EMAIL_DOMAIN ?? 'inbox.ledger.app'

/** Fetches the user's email ingest addresses (usually one row). */
export async function fetchEmailIngestAddresses(): Promise<EmailIngestAddress[]> {
  const { data, error } = await supabase
    .from('email_ingest_addresses')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as EmailIngestAddress[]
}

/** Creates or reuses a per-user email ingest alias. Returns the alias local part. */
export async function createEmailIngestAddress(): Promise<EmailIngestAddress> {
  const { data: alias, error: rpcError } = await supabase.rpc('create_email_ingest_address')
  if (rpcError) throw rpcError

  // Fetch the full row so the UI has everything (verified_at, etc.)
  const { data: row, error } = await supabase
    .from('email_ingest_addresses')
    .select('*')
    .eq('inbound_alias', String(alias))
    .single()
  if (error) throw error
  return row as EmailIngestAddress
}

/** Toggles the active state of an email ingest address. */
export async function setEmailIngestActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase
    .from('email_ingest_addresses')
    .update({ is_active: isActive, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

/** Deletes the email ingest address (keeps logs). */
export async function deleteEmailIngestAddress(id: string): Promise<void> {
  const { error } = await supabase.from('email_ingest_addresses').delete().eq('id', id)
  if (error) throw error
}

/** Recent email ingest logs for the audit trail / replay. */
export async function fetchEmailIngestLogs(): Promise<EmailIngestLogRow[]> {
  const { data, error } = await supabase
    .from('email_ingest_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data as EmailIngestLogRow[]
}

/** Full address the user tells their bank to send statements to. */
export function fullInboundAddress(localPart: string): string {
  return `${localPart}@${INBOUND_DOMAIN}`
}