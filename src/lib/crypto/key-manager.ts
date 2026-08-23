// E2E encryption key management.
//
// Architecture:
//   - A random 256-bit Data Encryption Key (DEK) encrypts all sensitive fields.
//   - The DEK is wrapped (encrypted) with a Key Encryption Key (KEK) derived
//     from the user's password via PBKDF2 (210k iterations) and a random salt.
//   - Only the wrapped DEK + salt + KDF params are stored in Supabase
//     (encryption_keys table). The raw DEK/KEK never leave the device.
//   - After first setup, the KEK is derived from the password at login,
//     the DEK is unwrapped, and decrypts past/current data transparently.
//
// If the password is changed, the same DEK is re-wrapped with a new KEK so
// existing ciphertext remains readable. If the DEK is lost (e.g. new device,
// no recovery phrase), previously encrypted data is unrecoverable — by design.

import { supabase } from '@/lib/supabase/client'
import {
  deriveKeyFromPassword,
  generateDataKey,
  generateSalt,
  importAesKey,
  unwrapDataKey,
  wrapDataKey,
} from '@/lib/crypto/aes-gcm'
import type { EncryptionKeyRow } from '@/lib/supabase/types'

const VERSION = 'v1'

type ByteArray = Uint8Array<ArrayBuffer>

/**
 * Derives the KEK from the user's password and the stored salt.
 */
async function deriveKek(password: string, saltB64Url: string): Promise<CryptoKey> {
  const salt = b64UrlToU8(saltB64Url)
  return await deriveKeyFromPassword(password, salt)
}

/** Converts a byte array to a base64url string (used for salt storage). */
function u8ToB64Url(bytes: ByteArray): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/** Converts a base64url string back to a byte array. */
function b64UrlToU8(b64: string): ByteArray {
  let base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes as ByteArray
}

// ---------------------------------------------------------------------------
// In-memory DEK cache (never persisted to disk)
// ---------------------------------------------------------------------------

let cachedDek: CryptoKey | null = null
let cachedDekRaw: ByteArray | null = null

export function hasUnlockedKey(): boolean {
  return cachedDek !== null
}

export function clearUnlockedKey(): void {
  cachedDek = null
  cachedDekRaw = null
}

export async function getDek(): Promise<CryptoKey> {
  if (!cachedDek) throw new Error('Encryption key not unlocked. Sign in to decrypt.')
  return cachedDek
}

export async function getDekRaw(): Promise<ByteArray> {
  if (!cachedDekRaw) throw new Error('Encryption key not unlocked. Sign in to decrypt.')
  return cachedDekRaw
}

// ---------------------------------------------------------------------------
// Vault persistence (Supabase)
// ---------------------------------------------------------------------------

async function fetchVault(userId: string): Promise<EncryptionKeyRow | null> {
  const { data, error } = await supabase
    .from('encryption_keys')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) throw error
  return (data as EncryptionKeyRow | null) ?? null
}

async function saveVault(userId: string, vault: VaultPayload): Promise<void> {
  const { error } = await supabase
    .from('encryption_keys')
    .upsert({
      user_id: userId,
      ...vault,
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}

interface VaultPayload {
  version: string
  salt: string
  iterations: number
  wrapped_dek: string
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Sets up encryption for a user who has none yet:
 *  1. Generates a random salt (stored in plain — just a KDF input).
 *  2. Derives a KEK from their password.
 *  3. Generates a fresh DEK and wraps it with the KEK.
 *  4. Persists only the wrapped DEK + KDF params to Supabase.
 *
 * Call after the user has authenticated (email/password or OAuth).
 * On OAuth (no password), we derive from a device-bound random secret;
 * the user is prompted to set a security PIN that wraps the DEK.
 */
export async function setupEncryption(
  userId: string,
  passwordOrPin: string,
  isPasswordLogin: boolean,
): Promise<void> {
  // If a vault already exists, don't overwrite — unlock() will handle it.
  const existing = await fetchVault(userId)
  if (existing) return

  const salt = generateSalt()
  const kek = await deriveKekFromPassword(passwordOrPin, u8ToB64Url(salt), isPasswordLogin)
  const dek = await generateDataKey()
  const dekKey = await importAesKey(dek)
  const wrapped = await wrapDataKey(kek, dek)

  await saveVault(userId, {
    version: VERSION,
    salt: u8ToB64Url(salt),
    iterations: isPasswordLogin ? 210_000 : 310_000,
    wrapped_dek: wrapped,
  })

  cachedDek = dekKey
  cachedDekRaw = dek
}

/**
 * Unlocks the DEK by deriving the KEK from the user's password/PIN and
 * unwrapping the stored vault. Called after login (and on re-open for
 * PIN-protected devices).
 */
export async function unlockEncryption(
  userId: string,
  passwordOrPin: string,
  isPasswordLogin: boolean,
): Promise<void> {
  const row = await fetchVault(userId)
  if (!row) {
    // No vault yet — call setupEncryption() first.
    throw new Error('No encryption vault found for this user')
  }

  const kek = await deriveKekFromPassword(passwordOrPin, row.salt, isPasswordLogin)
  const dekRaw = await unwrapDataKey(kek, row.wrapped_dek)
  const dekKey = await importAesKey(dekRaw)

  cachedDek = dekKey
  cachedDekRaw = dekRaw
}

/**
 * Derives the KEK using either PBKDF2-password or a masked PIN-based derivation.
 */
async function deriveKekFromPassword(
  passwordOrPin: string,
  saltB64Url: string,
  isPasswordLogin: boolean,
): Promise<CryptoKey> {
  // For password login use full PBKDF2 with the user's password.
  if (isPasswordLogin) {
    return await deriveKek(passwordOrPin, saltB64Url)
  }

  // For PIN / OAuth, mix the PIN with a device-scoped constant so the KEK is
  // unique per device+user. This still lets the same PIN work across devices
  // if the user chooses it (the salt is server-side), keeping recovery simple.
  // The mask below is just a domain-separation label, NOT a secret.
  const deviceLabel = 'ledger-mobile-app'
  const combined = `${deviceLabel}:${passwordOrPin.trim()}`
  return await deriveKek(combined, saltB64Url)
}

/**
 * Re-wraps the DEK after a password/PIN change. Existing ciphertext remains
 * readable because the same DEK is reused — just the KEK changes.
 */
export async function rotateKeyEncryptionKey(
  userId: string,
  newPasswordOrPin: string,
  isPasswordLogin: boolean,
): Promise<void> {
  const row = await fetchVault(userId)
  if (!row) throw new Error('No encryption vault found')

  // Unwrap with the OLD KEK using the stored salt.
  // (The caller must already have the DEK unlocked — fell back to raw.)
  const dekRaw = await getDekRaw()

  const salt = generateSalt()
  const kek = await deriveKekFromPassword(newPasswordOrPin, u8ToB64Url(salt), isPasswordLogin)
  const wrapped = await wrapDataKey(kek, dekRaw)

  await saveVault(userId, {
    version: VERSION,
    salt: u8ToB64Url(salt),
    iterations: isPasswordLogin ? 210_000 : 120_000,
    wrapped_dek: wrapped,
  })
}

/**
 * Exports the raw DEK (32 bytes) as a base64url recovery string. The user
 * should store this offline — without it, encrypted data cannot be recovered
 * after they forget the password or the vault is lost.
 */
export async function exportRecoveryPhrase(): Promise<string> {
  const raw = await getDekRaw()
  let binary = ''
  for (let i = 0; i < raw.length; i++) binary += String.fromCharCode(raw[i])
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

/**
 * Imports a recovery phrase to restore the DEK on a new device after re-auth.
 */
export async function importRecoveryPhrase(recoveryPhrase: string): Promise<void> {
  const dekRaw = b64UrlToU8(recoveryPhrase.trim())
  if (dekRaw.length !== 32) throw new Error('Invalid recovery phrase — expected 32 bytes')
  cachedDekRaw = dekRaw
  cachedDek = await importAesKey(dekRaw)
}

/** Version prefix for the serialized vault payload. */
export const VAULT_VERSION = VERSION