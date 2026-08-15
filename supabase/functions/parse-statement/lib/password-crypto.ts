// Encrypts / decrypts statement passwords using Web Crypto (AES-GCM).
//
// The encryption key is derived from the STATEMENT_PASSWORD_KEY environment
// variable. If that isn't configured, we fall back to deriving from the
// SUPABASE_SERVICE_ROLE_KEY so the function still works out of the box —
// the ciphertext is only ever stored in the statement_passwords table, and
// the plaintext key material never touches the database.

const encoder = new TextEncoder()
const decoder = new TextDecoder()

async function sha256(data: Uint8Array): Promise<ArrayBuffer> {
  return await crypto.subtle.digest('SHA-256', data.buffer as ArrayBuffer)
}

async function getKey(): Promise<CryptoKey> {
  const secret =
    Deno.env.get('STATEMENT_PASSWORD_KEY') ??
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ??
    'statement-password-fallback-key'
  const keyBytes = await sha256(encoder.encode(secret))
  return await crypto.subtle.importKey(
    'raw',
    keyBytes,
    { name: 'AES-GCM' },
    false,
    ['encrypt', 'decrypt'],
  )
}

/** Encrypts a plaintext password. Returns "ivBase64:ciphertextBase64". */
export async function encryptPassword(plaintext: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const key = await getKey()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(plaintext),
  )
  const ivB64 = btoa(String.fromCharCode(...iv))
  const ctB64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)))
  return `${ivB64}:${ctB64}`
}

/** Decrypts a value produced by encryptPassword. Returns null on failure. */
export async function decryptPassword(stored: string): Promise<string | null> {
  try {
    const [ivB64, ctB64] = stored.split(':')
    if (!ivB64 || !ctB64) return null
    const iv = Uint8Array.from(atob(ivB64), (c) => c.charCodeAt(0))
    const ct = Uint8Array.from(atob(ctB64), (c) => c.charCodeAt(0))
    const key = await getKey()
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ct)
    return decoder.decode(plain)
  } catch {
    return null
  }
}