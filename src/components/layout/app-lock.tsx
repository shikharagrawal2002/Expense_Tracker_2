// App Lock overlay that appears when a logged-in user hasn't unlocked the
// encryption key (e.g. after a page refresh or on-device restart with the
// session persisted).
//
// On Android (Capacitor) this uses the native BiometricPrompt via
// @aparajita/capacitor-biometric-auth. On web it falls back to WebAuthn
// (platform authenticator) so the flow still works in browsers.

import { useEffect, useRef, useState } from 'react'
import { ShieldCheck, Loader2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { unlockWithCredential } from '@/lib/crypto/auth-encryption'
import { authenticateWithBiometrics, isNativeBiometricSupported } from '@/lib/native/biometric'

interface AppLockProps {
  userId: string
  onUnlocked: () => void
}

export function AppLock({ userId, onUnlocked }: AppLockProps) {
  const [pin, setPin] = useState('')
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
    if (pin.length < 4 || attempting) return
    setAttempting(true)
    setError(null)

    try {
      const ok = await unlockWithCredential(userId, pin, false)
      if (ok) {
        onUnlocked()
      } else {
        setError('Incorrect PIN. Try again.')
        setPin('')
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
        // User dismissed the prompt — keep the PIN input available.
        setPin('')
        inputRef.current?.focus()
      } else {
        setError('Biometric authentication cancelled or unavailable.')
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
        <p className="text-sm text-muted mt-1 mb-6">
          Your data is encrypted. Enter your security PIN {biometricAvailable ? 'or use biometrics' : ''} to unlock.
        </p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            void handleUnlock()
          }}
          className="space-y-3"
        >
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(e) => {
              const digits = e.target.value.replace(/\D/g, '').slice(0, 6)
              setPin(digits)
            }}
            placeholder="••••••"
            className="w-full text-center font-mono text-lg tracking-[0.5em] h-12 rounded-xl surface-2 border border-hairline px-3"
            aria-label="Security PIN"
          />
          {error && <p className="text-xs text-[var(--color-negative-600)]">{error}</p>}
          <Button type="submit" className="w-full" disabled={attempting || pin.length < 4}>
            {attempting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
            Unlock
          </Button>
        </form>

        {biometricAvailable && (
          <Button variant="outline" className="w-full mt-3" onClick={() => void handleBiometric()} disabled={attempting}>
            <Lock className="h-4 w-4" />
            Use biometrics
          </Button>
        )}

        <p className="text-[11px] text-muted mt-6">
          {isNativeBiometricSupported()
            ? 'Protected by Android Keystore + BiometricPrompt.'
            : 'Uses WebAuthn on the web; Android uses the native BiometricPrompt.'}
        </p>
      </div>
    </div>
  )
}