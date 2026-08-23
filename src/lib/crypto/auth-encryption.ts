// Auth-integrated encryption lifecycle.
//
// After a user signs in (email/password or OAuth), the encryption layer is
// activated: a new vault is created on first login, or the existing vault is
// unlocked with the user's password. Wraps setup/unlock/rotate into simple
// functions `useAuthEncryption` can call.

import { supabase } from '@/lib/supabase/client'
import { setupEncryption, unlockEncryption, hasUnlockedKey } from '@/lib/crypto/key-manager'

/**
 * Creates an encryption vault for a user on first login.
 *
 * - Email/password: derives the KEK from their password directly.
 * - OAuth / other: prompts for a 6-digit PIN (or falls back to a generated
 *   device secret if they skip) and derives the KEK from that.
 */
export async function ensureEncryptionSetup(userId: string, passwordOrPin: string, isPasswordLogin: boolean): Promise<void> {
  await setupEncryption(userId, passwordOrPin, isPasswordLogin)

  // Mark profile as encrypted
  const { error } = await supabase.from('profiles').update({
    encryption_enabled: true,
    encryption_setup_at: new Date().toISOString(),
  }).eq('id', userId)
  // Non-critical — if the update fails, the UI can still show the state via the
  // presence of an encryption_keys row. Don't throw.
  if (error) console.warn('[encryption] Could not flag profile:', error.message)
}

/**
 * Unlocks the DEK after login using the user's password/PIN.
 * Errors bubble up if the password/PIN is wrong (mismatched KEK).
 */
export async function unlockWithCredential(userId: string, passwordOrPin: string, isPasswordLogin: boolean): Promise<boolean> {
  if (hasUnlockedKey()) return true
  try {
    await unlockEncryption(userId, passwordOrPin, isPasswordLogin)
    return true
  } catch {
    return false
  }
}