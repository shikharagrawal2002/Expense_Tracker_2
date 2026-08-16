import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

const hasValidSupabaseUrl = (value: string | undefined) => {
  if (!value || value === 'https://placeholder.supabase.co') return false

  try {
    return new URL(value).protocol === 'https:'
  } catch {
    return false
  }
}

export const isSupabaseConfigured = hasValidSupabaseUrl(supabaseUrl) && Boolean(supabaseAnonKey)

if (!isSupabaseConfigured) {
  // eslint-disable-next-line no-console
  console.warn(
    '[supabase] VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY are missing or invalid. ' +
      'Copy .env.example to .env.local locally, or set them as GitHub Actions / Vercel secrets for deploys.',
  )
}

// createClient() throws synchronously on an empty/invalid URL, which would crash
// the whole app before React can render anything (a blank white screen with no
// useful UI). Falling back to a syntactically valid placeholder lets the app boot
// so `isSupabaseConfigured` can drive a proper "not configured" screen instead.
export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder-anon-key',
)
