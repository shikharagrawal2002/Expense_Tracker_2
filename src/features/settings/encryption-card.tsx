import { useState } from 'react'
import { ShieldCheck, KeyRound, Copy, Loader2, Eye, Lock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/features/auth/use-auth'
import { hasUnlockedKey, exportRecoveryPhrase, rotateKeyEncryptionKey } from '@/lib/crypto/key-manager'

export function EncryptionCard() {
  const { user, isEncryptionUnlocked } = useAuth()
  const [showRecovery, setShowRecovery] = useState(false)
  const [recoveryPhrase, setRecoveryPhrase] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [loading, setLoading] = useState(false)
  const [newPin, setNewPin] = useState('')
  const [rotateMsg, setRotateMsg] = useState<string | null>(null)

  const unlocked = isEncryptionUnlocked || hasUnlockedKey()

  const handleExport = async () => {
    setLoading(true)
    try {
      const phrase = await exportRecoveryPhrase()
      setRecoveryPhrase(phrase)
      setShowRecovery(true)
    } catch (e) {
      setRotateMsg((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!recoveryPhrase) return
    await navigator.clipboard.writeText(recoveryPhrase)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleRotatePin = async () => {
    if (!user || newPin.length < 4) return
    setLoading(true)
    setRotateMsg(null)
    try {
      await rotateKeyEncryptionKey(user.id, newPin, false)
      setRotateMsg('Security PIN updated. Existing data remains encrypted.')
      setNewPin('')
    } catch (e) {
      setRotateMsg((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-positive-600)]" />
          End-to-end encryption
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted">
          Your sensitive data is encrypted with AES-256-GCM before it ever leaves this device.
        </p>

        <div className={`flex items-center gap-2 text-sm ${unlocked ? 'text-[var(--color-positive-600)]' : 'text-[var(--color-warning-600)]'}`}>
          <span className={`h-2 w-2 rounded-full ${unlocked ? 'bg-[var(--color-positive-500)]' : 'bg-[var(--color-warning-500)]'}`} />
          {unlocked ? 'Encryption key unlocked — data decrypts on-device' : 'Key locked — enter your PIN to decrypt'}
        </div>

        <div className="border-t border-hairline pt-4 space-y-2">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <KeyRound className="h-3.5 w-3.5 text-[var(--color-brand-500)]" />
            Recovery phrase
          </p>
          <p className="text-xs text-muted">
            Store this phrase offline — without it, encrypted data is unrecoverable.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => void handleExport()} disabled={loading || !unlocked}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Eye className="h-3.5 w-3.5" />}
              {showRecovery ? 'Hide phrase' : 'Show phrase'}
            </Button>
            {recoveryPhrase && (
              <Button size="sm" variant="outline" onClick={handleCopy}>
                {copied ? 'Copied' : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
            )}
          </div>
          {showRecovery && recoveryPhrase && (
            <div className="rounded-lg bg-[var(--color-border-light)]/50 dark:bg-[var(--color-border-dark)]/50 p-3">
              <code className="text-xs break-all font-mono">{recoveryPhrase}</code>
            </div>
          )}
        </div>

        <div className="border-t border-hairline pt-4 space-y-2">
          <p className="text-sm font-medium">Change security PIN</p>
          <p className="text-xs text-muted">Re-wraps your encryption key with a new PIN.</p>
          <div className="flex gap-2 items-end">
            <Input
              type="password"
              inputMode="numeric"
              placeholder="New 4-6 digit PIN"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="max-w-[180px]"
            />
            <Button size="sm" onClick={handleRotatePin} disabled={loading || !unlocked || newPin.length < 4}>
              {loading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Update PIN
            </Button>
          </div>
          {rotateMsg && <p className="text-xs text-muted">{rotateMsg}</p>}
        </div>

        <p className="text-[11px] text-muted border-t border-hairline pt-3 flex items-center gap-1">
          <Lock className="h-3 w-3" />
          On the Android app this is backed by hardware-level Android Keystore encryption.
        </p>
      </CardContent>
    </Card>
  )
}