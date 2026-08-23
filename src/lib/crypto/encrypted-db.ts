// Transparent E2E encryption adapter over the Supabase client.
// Sensitive columns are stored as "e2e:v1:<ciphertext>" strings.

import { supabase } from '@/lib/supabase/client'
import { encryptRow, decryptRows } from '@/lib/crypto/fields'

/** Fetch rows with E2E decryption applied to the declared sensitive fields. */
export async function encryptedSelect<T extends Record<string, unknown>>(
  table: string,
  sensitive: Array<keyof T>,
  options: {
    orderBy?: string
    orderAscending?: boolean
    limit?: number
    filters?: Record<string, unknown>
    matchAny?: Array<{ column: string; values: string[] }>
  } = {},
): Promise<T[]> {
  let query = supabase.from(table).select('*')

  if (options.filters) {
    for (const [column, value] of Object.entries(options.filters)) {
      query = query.eq(column, value as never)
    }
  }
  if (options.matchAny) {
    for (const m of options.matchAny) {
      query = query.or(`in.(${m.values.join(',')})`)
    }
  }
  if (options.orderBy) {
    query = query.order(options.orderBy, { ascending: options.orderAscending ?? true })
  }
  if (options.limit) {
    query = query.limit(options.limit)
  }

  const { data, error } = await query
  if (error) throw error
  const rows = (data ?? []) as unknown as T[]
  return await decryptRows(rows, [...sensitive])
}

/** Fetch a single row by id, decrypting sensitive fields. */
export async function encryptedFind<T extends Record<string, unknown>>(
  table: string,
  id: string,
  sensitive: Array<keyof T>,
): Promise<T | null> {
  const { data, error } = await supabase.from(table).select('*').eq('id', id as never).maybeSingle()
  if (error) throw error
  if (!data) return null
  const rows = await decryptRows([data as unknown as T], [...sensitive])
  return rows[0] ?? null
}

/** Insert one encrypted row, returning the decrypted row. */
export async function encryptInsert<T extends Record<string, unknown>>(
  table: string,
  row: T,
  sensitive: Array<keyof T>,
): Promise<T> {
  const encrypted = await encryptRow(row, sensitive)
  const { data, error } = await supabase.from(table).insert([encrypted as unknown], { count: 'exact' }).select().single()
  if (error) throw error
  const out = (data ?? {}) as T
  return (await decryptRows([out], sensitive))[0]
}

/** Insert many encrypted rows, returning the decrypted rows. */
export async function encryptInsertMany<T extends Record<string, unknown>>(
  table: string,
  rows: T[],
  sensitive: Array<keyof T>,
): Promise<T[]> {
  if (rows.length === 0) return []
  const encrypted = await Promise.all(rows.map((row) => encryptRow(row, sensitive)))
  const { data, error } = await supabase.from(table).insert(encrypted as 0[], { count: 'exact' }).select()
  if (error) throw error
  const out = (data ?? []) as unknown as T[]
  return await decryptRows(out, sensitive)
}

/** Update a row, encrypting only the sensitive fields present in the patch. */
export async function encryptUpdate<T extends Record<string, unknown>>(
  table: string,
  id: string,
  patch: Partial<T>,
  sensitive: Array<keyof T>,
): Promise<T | null> {
  const encrypted = await encryptRow({ ...patch } as T, sensitive)
  const { data, error } = await supabase.from(table).update(encrypted as unknown as never).eq('id', id as never).select().single()
  if (error) throw error
  const out = (data ?? null) as T | null
  if (!out) return null
  return (await decryptRows([out], sensitive))[0]
}