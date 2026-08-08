import { supabase } from '@/lib/supabase/client'
import type { SmsTransaction, SmsSource } from '@/lib/supabase/types'

export async function fetchPendingSms(): Promise<SmsTransaction[]> {
  const { data, error } = await supabase
    .from('sms_transactions')
    .select('*, account:accounts!sms_transactions_account_id_fkey(id,name,color,icon)')
    .eq('status', 'pending')
    .order('received_at', { ascending: false })
    .limit(100)
  if (error) throw error
  return data as unknown as SmsTransaction[]
}

export async function fetchSmsHistory(): Promise<SmsTransaction[]> {
  const { data, error } = await supabase
    .from('sms_transactions')
    .select('*, account:accounts!sms_transactions_account_id_fkey(id,name,color,icon)')
    .in('status', ['confirmed', 'skipped', 'duplicate'])
    .order('received_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data as unknown as SmsTransaction[]
}

export async function confirmSmsTransaction(
  smsId: string,
  accountId: string,
  categoryId?: string,
): Promise<string> {
  const { data, error } = await supabase.rpc('confirm_sms_transaction', {
    p_sms_id: smsId,
    p_account_id: accountId,
    p_category_id: categoryId ?? null,
  })
  if (error) throw error
  return data as string
}

export async function skipSmsTransaction(smsId: string): Promise<void> {
  const { error } = await supabase.rpc('skip_sms_transaction', { p_sms_id: smsId })
  if (error) throw error
}

export async function fetchSmsSources(): Promise<SmsSource[]> {
  const { data, error } = await supabase
    .from('sms_sources')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as SmsSource[]
}

export async function createSmsSource(input: {
  sender_phone: string
  bank_name: string
  upi_vpa?: string | null
}): Promise<SmsSource> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('sms_sources')
    .insert({ ...input, upi_vpa: input.upi_vpa ?? null, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as SmsSource
}

export async function deleteSmsSource(id: string): Promise<void> {
  const { error } = await supabase.from('sms_sources').delete().eq('id', id)
  if (error) throw error
}

export async function generateSmsApiKey(): Promise<string> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  // Generate a random API key
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const apiKey = Array.from(array, (b) => b.toString(16).padStart(2, '0')).join('')

  // Try to update the profile. If the profile row doesn't exist yet, upsert it.
  const { data: existingProfile, error: fetchError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', userId)
    .single()

  if (fetchError && !fetchError.message?.includes('PGRST116')) {
    throw fetchError
  }

  const { error } = existingProfile
    ? await supabase.from('profiles').update({ sms_api_key: apiKey }).eq('id', userId)
    : await supabase.from('profiles').upsert({
        id: userId,
        sms_api_key: apiKey,
        base_currency: 'INR',
      })

  if (error) {
    // Provide a helpful message for migration issues
    const isMissingColumn = error.code === '42703' || error.message?.includes('column') || error.message?.includes('relation')
    throw new Error(
      isMissingColumn
        ? 'The sms_transactions migration (0009) has not been applied to your database. Open the Supabase Dashboard → SQL Editor and run the contents of supabase/migrations/0009_sms_tracking.sql, or run `supabase db push`.'
        : error.message,
    )
  }
  return apiKey
}

export async function fetchSmsApiKey(): Promise<string | null> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('sms_api_key')
      .eq('id', userId)
      .single()

    // If the query fails because the column doesn't exist, the migration wasn't applied.
    // This is not a critical error — the user just hasn't generated a key yet.
    if (error) {
      console.warn('[sms] Could not fetch API key:', error.message)
      return null
    }

    return (data as { sms_api_key: string | null } | null)?.sms_api_key ?? null
  } catch (err) {
    // Never throw for a missing key — the UI should still allow generating one.
    console.warn('[sms] Error fetching API key:', err)
    return null
  }
}
