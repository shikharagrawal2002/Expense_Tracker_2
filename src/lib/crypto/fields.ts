// Field-level E2E encryption helpers.
//
// Sensitive fields are encrypted before they reach Supabase and decrypted
// after fetch. Each field is prefixed with "e2e:" so the API layer can
// transparently detect and decrypt. Plaintext (non-sensitive) values pass
// through untouched.

import { aesDecrypt, aesEncrypt } from '@/lib/crypto/aes-gcm'
import { getDek, hasUnlockedKey } from '@/lib/crypto/key-manager'

const E2E_PREFIX = 'e2e:v1:'

/**
 * Encrypts a sensitive string field. Returns null for null/empty input.
 * The ciphertext is prefixed with "e2e:v1:" so decryption can be detected.
 */
export async function encryptField(plain: string | null | undefined): Promise<string | null> {
  if (plain == null || plain === '') return null
  if (plain.startsWith(E2E_PREFIX)) return plain // already encrypted
  const key = await getDek()
  const ct = await aesEncrypt(key, plain)
  return `${E2E_PREFIX}${ct}`
}

/**
 * Decrypts a sensitive string field. Returns null for null input.
 * If the value is not prefixed (legacy plaintext), it passes through unchanged.
 */
export async function decryptField(stored: string | null | undefined): Promise<string | null> {
  if (stored === null || stored === undefined || stored === '') return null
  if (!stored.startsWith(E2E_PREFIX)) return stored // legacy plaintext or non-sensitive
  if (!hasUnlockedKey()) return '[locked]'
  const key = await getDek()
  const ct = stored.slice(E2E_PREFIX.length)
  const plain = await aesDecrypt(key, ct)
  return plain ?? null
}

/** Encrypts a numeric field by converting it to a string first. */
export async function encryptNumberField(value: number | null | undefined): Promise<string | null> {
  if (value === null || value === undefined) return null
  const enc = await encryptField(String(value))
  return enc
}

/** Decrypts a numeric field stored as ciphertext. Returns null if unreadable. */
export async function decryptNumberField(stored: string | null | undefined): Promise<number | null> {
  if (stored === null || stored === undefined || stored === '') return null
  const plain = await decryptField(stored)
  if (plain === null) return null
  if (plain === '[locked]') return 0
  const num = Number(plain)
  return Number.isNaN(num) ? null : num
}

/**
 * Encrypts specific fields on a DB row before insert/update.
 * Only the fields in the mapping are transformed; others pass through.
 */
export async function encryptRow<T extends Record<string, unknown>>(
  row: T,
  fields: Array<keyof T>,
): Promise<T> {
  const result = { ...row }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string') {
      result[field] = (await encryptField(value)) as T[keyof T]
    }
    // Numeric fields are NOT encrypted — they must remain numeric for
    // SQL-side aggregation (recalculate_balances, get_balance_as_of, reports).
    // Only free-text fields (name, notes, location, etc.) are E2E encrypted.
  }
  return result
}

/** Decrypts specified fields on an object returned from Supabase. */
export async function decryptRow<T extends Record<string, unknown>>(
  row: T,
  fields: Array<keyof T>,
): Promise<T> {
  const result = { ...row }
  for (const field of fields) {
    const value = result[field]
    if (typeof value === 'string') {
      result[field] = (await decryptField(value)) as T[keyof T]
    }
  }
  return result
}

/** Decrypts an array of rows. */
export async function decryptRows<T extends Record<string, unknown>>(
  rows: T[],
  fields: Array<keyof T>,
): Promise<T[]> {
  return await Promise.all(rows.map((row) => decryptRow(row, fields)))
}

/** Encrypts an array of rows before bulk insert. */
export async function encryptRows<T extends Record<string, unknown>>(
  rows: T[],
  fields: Array<keyof T>,
): Promise<T[]> {
  return await Promise.all(rows.map((row) => encryptRow(row, fields)))
}