import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase/client'
import { ensureEncryptionSetup, unlockWithCredential } from '@/lib/crypto/auth-encryption'
import { clearUnlockedKey, hasUnlockedKey } from '@/lib/crypto/key-manager'

interface AuthContextValue {
  session: Session | null
  user: User | null
  isLoading: boolean
  isEncryptionUnlocked: boolean
  signInWithPassword: (email: string, password: string) => Promise<{ error: string | null }>
  signUpWithPassword: (email: string, password: string, fullName: string) => Promise<{ error: string | null }>
  signInWithOAuth: (provider: 'google' | 'github') => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isEncryptionUnlocked, setIsEncryptionUnlocked] = useState(false)

  // On session restore (page refresh), keep the key unlocked if it's already
  // in memory; otherwise the AppLock screen asks for the security PIN.
  useEffect(() => {
    if (session?.user && hasUnlockedKey()) {
      setIsEncryptionUnlocked(true)
    }
  }, [session?.user?.id])

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data }) => {
        setSession(data.session)
      })
      .catch(() => {
        setSession(null)
      })
      .finally(() => {
        setIsLoading(false)
      })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
    })

    return () => subscription.subscription.unsubscribe()
  }, [])

  const signInWithPassword: AuthContextValue['signInWithPassword'] = async (email, password) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { error: error?.message ?? null }
      if (!data.user) return { error: 'Sign-in succeeded but no user was returned.' }

      // E2E: set up the vault on first login, then unlock with the password.
      try {
        await ensureEncryptionSetup(data.user.id, password, true)
        await unlockWithCredential(data.user.id, password, true)
        setIsEncryptionUnlocked(true)
      } catch (e) {
        // Best-effort — if the vault table doesn't exist yet, the app still works.
        console.warn('[encryption] Could not set up encryption:', e)
      }
      return { error: null }
    } catch {
      return { error: 'Unable to connect to Supabase. Check the project configuration and try again.' }
    }
  }

  const signUpWithPassword: AuthContextValue['signUpWithPassword'] = async (email, password, fullName) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) return { error: error?.message ?? null }
      if (data.user) {
        try {
          await ensureEncryptionSetup(data.user.id, password, true)
          setIsEncryptionUnlocked(true)
        } catch (e) {
          console.warn('[app] Could not set up encryption:', e)
        }
      }
      return { error: null }
    } catch {
      return { error: 'Unable to connect to Supabase. Check the project configuration and try again.' }
    }
  }

  const signInWithOAuth: AuthContextValue['signInWithOAuth'] = async (provider) => {
    await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin + import.meta.env.BASE_URL },
    })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    clearUnlockedKey()
    setIsEncryptionUnlocked(false)
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        isLoading,
        isEncryptionUnlocked,
        signInWithPassword,
        signUpWithPassword,
        signInWithOAuth,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}