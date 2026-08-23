// Secure local storage for sensitive values (tokens, API keys).
//
// @capacitor/preferences writes plaintext to device storage, so we encrypt
// every value with the E2E DEK (which only exists in memory after the user
// unlocks with PIN/biometric). At rest the ciphertext is unreadable; it is
// only decryptable after the app is unlocked in this session.

import { Preferences } from '@capacitor/preferences'
import { Capacitor } from '@capacitor/core'
import { aesEncrypt, aesDecrypt } from '@/lib/crypto/aes-gcm'
import { getDek } from '@/lib/crypto/key-manager'

const ENC_PREFIX = 'e2e:v1:'

function keyForPlatform(key: string): string {
  return Capacitor.isNativePlatform() ? key : `ledger.${key}`
}

export async function secureGet(key: string): Promise<string | null> {
  const { value } = await Preferences.get({ key: keyForPlatform(key) })
  if (!value) return null
  if (!value.startsWith(ENC_PREFIX)) return value // legacy plaintext
  try {
    const dek = await getDek()
    const plain = await aesDecrypt(dek, value.slice(ENC_PREFIX.length))
    return plain
  } catch {
    return null
  }
}

export async function secureSet(key: string, value: string): Promise<void> {
  const dek = await getDek()
  const ct = await aesEncrypt(dek, value)
  await Preferences.set({ key: keyForPlatform(key), value: `${ENC_PREFIX}${ct}` })
}

export async function secureRemove(key: string): Promise<void> {
  await Preferences.remove({ key: keyForPlatform(key) })
}
