// App Lock overlay shown when a logged-in user hasn't unlocked the E2E
// encryption key (e.g. after a page refresh or device restart).
//
// Unlock options:
//  - Account password (default) — matches how the vault was originally wrapped
//    at signup/login (PBKDF2 over the Supabase password).
//  - Security PIN — only valid if the user rotated the KEK to a PIN in Settings.
//
// On Android (Capacitor) the native BiometricPrompt is also offered; on web
// WebAuthn platform authenticator is used as the biometric fallback.

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Loader2, Lock, KeyRound, Fingerprint } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { unlockWithCredential } from '@/lib/crypto/auth-encryption'
import { authenticateWithBiometrics, isNativeBiometricSupported } from '@/lib/native/biometric'
import { useAuth } from '@/features/auth/use-auth'

interface AppLockProps {
  userId: string
  onUnlocked: () => void
}

type Mode = 'password' | 'pin'

export function AppLock({ userId, onUnlocked }: AppLockProps) {
  const { signOut } = useAuth()
  const [mode, setMode] = useState<Mode>('password')
  const [secret, setSecret] = useState('')
  const [attempting, setAttempting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [biometricAvailable, setBiometricAvailable] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  useEffect(() => {
    const check = async () => {
      if (isNativeBiometricSupported()) {
        setBiometricAvailable(true)
        return
      }
      try {
        setBiometricAvailable(typeof window.PublicKeyCredential !== 'undefined')
      } catch {
        setBiometricAvailable(false)
      }
    }
    void check()
  }, [])

  const handleUnlock = async () => {
    if (secret.length < 4 || attempting) return
    setAttempting(true)
    setError(null)

    try {
      // Password mode unwraps the original vault; PIN mode only works if the
      // user rotated the KEK to a PIN in Settings → Encryption.
      const ok = await unlockWithCredential(userId, secret, mode === 'password')
      if (ok) {
        onUnlocked()
      } else {
        setError(
          mode === 'password'
            ? 'Incorrect account password.'
            : 'Incorrect PIN. If you never set a PIN, unlock with your account password.',
        )
        setSecret('')
        inputRef.current?.focus()
      }
    } finally {
      setAttempting(false)
    }
  }

  const handleBiometric = async () => {
    if (!biometricAvailable) return
    setAttempting(true)
    setError(null)
    try {
      const result = await authenticateWithBiometrics()
      if (result === 'success') {
        onUnlocked()
      } else if (result === 'cancelled') {
        inputRef.current?.focus()
      } else {
        setError('Biometric authentication unavailable.')
      }
    } catch {
      setError('Biometric authentication cancelled or unavailable.')
    } finally {
      setAttempting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center surface backdrop-blur-2xl bg-background/90 px-6">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--color-brand-500)]/15">
          <Lock className="h-6 w-6 text-[var(--color-brand-500)]" />
        </div>
        <h1 className="font-display text-xl font-semibold mt-4">Ledger Locked</h1>
        <p className="text-sm text-muted mt-1 mb-5">
          Your data is encrypted. Enter your{' '}
          <span className="font-medium">{mode === 'password' ? 'account password' : 'security PIN'}</span> to unlock.
        </p>

        {/* Mode switch */}
        <div className="grid grid-cols-2 gap-1 surface-2 rounded-lg p-1 mb-4">
          <button
            onClick={() => {
              setMode('password')
              setSecret('')
              setError(null)
              inputRef.current?.focus()
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${mode === 'password' ? 'surface shadow-sm' : 'text-muted'}`}
          >
            <KeyRound className="h-3 w-3" />
            Password
          </button>
          <button
            onClick={() => {
              setMode('pin')
              setSecret('')
              setError(null)
              inputRef.current?.focus()
            }}
            className={`flex items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium transition-colors ${mode === 'pin' ? 'surface shadow-sm' : 'text-muted'}`}
          >
            <ShieldCheck className="h-3 w-3" />
            Security PIN
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleUnlock()
          }}
          className="space-y-3"
        >
          <input
            ref={inputRef}
            type={mode === 'password' ? 'password' : 'password'}
            inputMode={mode === 'pin' ? 'numeric' : 'text'}
            autoComplete={mode === 'password' ? 'current-password' : 'off'}
            value={secret}
            onChange={(e) => {
              if (mode === 'pin') {
                setSecret(e.target.value.replace(/\D/g, '').slice(0, 6))
              } else {
                setSecret(e.target.value)
              }
            }}
            placeholder={mode === 'password' ? 'Your account password' : '••••••'}
            className="w-full text-center font-mono text-base h-12 rounded-xl surface-2 border border-hairline px-3"
            aria-label={mode === 'password' ? 'Account password' : 'Security PIN'}
          />
          {error && <p className="text-xs text-[var(--color-negative-600)]">{error}</p>}
          <Button type="submit" className="w-full" disabled={attempting || secret.length < 4}>
            {attempting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Unlock
          </Button>
        </form>

        {biometricAvailable && (
          <Button variant="outline" className="w-full mt-3" onClick={() => void handleBiometric()} disabled={attempting}>
            <Fingerprint className="h-4 w-4" />
            Use biometrics
          </Button>
        )}

        <button
          onClick={() => void signOut()}
          className="mt-6 text-xs text-muted hover:text-[var(--color-negative-600)] underline underline-offset-2"
        >
          Sign out instead
        </button>
      </div>
    </div>
  )
}