// AES-GCM encryption helpers using the Web Crypto API.
//
// All sensitive plaintext fields are encrypted with AES-256-GCM before they
// ever leave the device. The ciphertext format is:
//
//   <iv-base64url>:<ciphertext-base64url>
//
// The 12-byte IV is random per encryption, so identical plaintext values
// produce different ciphertext — protecting against frequency analysis.

const IV_LENGTH = 12

type ByteArray = Uint8Array<ArrayBuffer>

function bufToB64Url(bytes: ByteArray): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

function b64UrlToBuf(b64: string): ByteArray {
  let base64 = b64.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4 !== 0) base64 += '='
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes as ByteArray
}

function toByteArray(buf: ArrayBuffer): ByteArray {
  return new Uint8Array(buf) as ByteArray
}

export async function aesEncrypt(key: CryptoKey, plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)) as ByteArray
  const encoded = new TextEncoder().encode(plaintext)
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return `${bufToB64Url(iv)}:${bufToB64Url(toByteArray(ciphertext))}`
}

export async function aesDecrypt(key: CryptoKey, stored: string): Promise<string | null> {
  try {
    const [ivB64, ctB64] = stored.split(':')
    if (!ivB64 || !ctB64) return null
    const iv = b64UrlToBuf(ivB64)
    const ct = b64UrlToBuf(ctB64)
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return new TextDecoder().decode(plain)
  } catch {
    return null
  }
}

/** Derives an AES-GCM key from raw key material (32 bytes). */
export async function importAesKey(rawKey: ByteArray): Promise<CryptoKey> {
  return await crypto.subtle.importKey(
    'raw',
    rawKey,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Generates a fresh 256-bit data encryption key (DEK). */
export async function generateDataKey(): Promise<ByteArray> {
  return crypto.getRandomValues(new Uint8Array(32)) as ByteArray
}

/** Derives a Key Encryption Key (KEK) from the user's password via PBKDF2. */
export async function deriveKeyFromPassword(
  password: string,
  salt: ByteArray,
  iterations = 210_000,
): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  )
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Wraps (encrypts) a raw 32-byte DEK using a KEK. Returns "iv:salt:ciphertext" url. */
export async function wrapDataKey(kek: CryptoKey, dek: ByteArray): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)) as ByteArray
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, dek)
  return `v1:${bufToB64Url(iv)}:${bufToB64Url(toByteArray(ciphertext))}`
}

/** Unwraps (decrypts) a wrapped DEK. Returns the raw 32 bytes. */
export async function unwrapDataKey(kek: CryptoKey, wrapped: string): Promise<ByteArray> {
  const [, ivB64, ctB64] = wrapped.split(':')
  if (!ivB64 || !ctB64) throw new Error('Invalid wrapped key format')
  const iv = b64UrlToBuf(ivB64)
  const ct = b64UrlToBuf(ctB64)
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, kek, ct)
  return toByteArray(raw)
}

/** Generates a random salt for PBKDF2 key derivation. */
export function generateSalt(): ByteArray {
  return crypto.getRandomValues(new Uint8Array(16)) as ByteArray
}