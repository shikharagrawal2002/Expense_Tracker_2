import { useState } from 'react'
import { Copy, KeyRound, Plus, Trash2, Check } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { useSmsApiKey, useGenerateSmsApiKey, useSmsSources, useCreateSmsSource, useDeleteSmsSource } from '@/features/sms/hooks'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''

export function SmsSettingsPage() {
  const { data: apiKey, isLoading: keyLoading } = useSmsApiKey()
  const generateKey = useGenerateSmsApiKey()
  const { data: sources } = useSmsSources()
  const createSource = useCreateSmsSource()
  const deleteSource = useDeleteSmsSource()

  const [showKey, setShowKey] = useState(false)
  const [copied, setCopied] = useState(false)
  const [senderPhone, setSenderPhone] = useState('')
  const [bankName, setBankName] = useState('')

  const serverUrl = `${SUPABASE_URL}/functions/v1/ingest-sms`

  const handleGenerateKey = async () => {
    try {
      await generateKey.mutateAsync()
    } catch (err) {
      // Error is shown via generateKey.error
    }
  }

  const handleCopy = async () => {
    if (!apiKey) return
    await navigator.clipboard.writeText(apiKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddSource = () => {
    if (!senderPhone.trim() || !bankName.trim()) return
    createSource.mutate({
      sender_phone: senderPhone.trim(),
      bank_name: bankName.trim(),
    })
    setSenderPhone('')
    setBankName('')
  }

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">SMS Tracking</h1>
        <p className="text-sm text-muted mt-0.5">
          Set up your Android phone to auto-forward bank/UPI SMS transactions to Ledger.
        </p>
      </div>

      {/* Step 1: Generate API Key */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-white text-xs font-bold">1</span>
            Generate your API key
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            This key lets your phone send SMS to Ledger. Generate it here, then paste it into the Ledger SMS app on your phone.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 num text-xs surface-2 border border-hairline rounded-lg px-3 py-2.5">
              {keyLoading ? 'Loading…' : showKey ? apiKey ?? 'Not generated yet' : apiKey ? `${apiKey.slice(0, 12)}…` : 'Not generated yet'}
            </code>
            <Button size="sm" variant="secondary" onClick={() => setShowKey((s) => !s)} disabled={!apiKey}>
              {showKey ? 'Hide' : 'Show'}
            </Button>
            <Button size="sm" variant="secondary" onClick={handleCopy} disabled={!apiKey}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {!apiKey && (
              <Button size="sm" onClick={handleGenerateKey} disabled={generateKey.isPending}>
                <KeyRound className="h-3.5 w-3.5" />
                {generateKey.isPending ? 'Generating…' : 'Generate'}
              </Button>
            )}
          </div>
          {generateKey.isError && (
            <p className="text-sm text-[var(--color-negative-600)]">
              {(generateKey.error as Error).message}
            </p>
          )}
          {!apiKey && !generateKey.isError && (
            <p className="text-xs text-muted">
              Click "Generate" to create your API key. If it fails, make sure you've applied the database migration (supabase/migrations/0009_sms_tracking.sql) to your Supabase project.
            </p>
          )}
          {apiKey && (
            <Button size="sm" variant="outline" onClick={handleGenerateKey} disabled={generateKey.isPending}>
              <KeyRound className="h-3.5 w-3.5" />
              Regenerate key
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Install & configure app */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-white text-xs font-bold">2</span>
            Install the Android app
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <ol className="list-decimal list-inside text-sm text-muted space-y-1.5">
            <li>Build the APK from <code className="num text-xs">android/SmsForwarder</code> in Android Studio, or install it directly</li>
            <li>Open the app and grant SMS permission</li>
            <li>Go to Settings and enter:</li>
          </ol>
          <div className="rounded-lg surface-2 border border-hairline p-3 space-y-2">
            <div>
              <p className="text-xs font-medium text-muted">Server URL:</p>
              <code className="num text-xs block mt-0.5">{serverUrl || 'Your Supabase function URL (/functions/v1/ingest-sms)'}</code>
            </div>
            <div>
              <p className="text-xs font-medium text-muted">API Key:</p>
              <code className="num text-xs block mt-0.5">{apiKey ?? 'Generate above first'}</code>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Add known SMS senders */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--color-brand-500)] text-white text-xs font-bold">3</span>
            Known SMS senders
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Add the phone numbers/sender names of your banks to improve auto-detection.
          </p>
          <div className="flex flex-wrap gap-2 items-end">
            <div className="flex-1 min-w-[160px]">
              <Label>Sender / phone</Label>
              <Input
                value={senderPhone}
                onChange={(e) => setSenderPhone(e.target.value)}
                placeholder="e.g. HDFCBK or +91-88XX"
              />
            </div>
            <div className="flex-1 min-w-[160px]">
              <Label>Bank name</Label>
              <Input
                value={bankName}
                onChange={(e) => setBankName(e.target.value)}
                placeholder="e.g. HDFC Bank"
              />
            </div>
            <Button size="sm" onClick={handleAddSource} disabled={!senderPhone.trim() || !bankName.trim()}>
              <Plus className="h-3.5 w-3.5" />
              Add
            </Button>
          </div>

          {sources && sources.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {sources.map((source) => (
                <div key={source.id} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm font-medium">{source.bank_name}</p>
                    <p className="text-xs text-muted num">{source.sender_phone}</p>
                  </div>
                  <Button variant="ghost" size="icon" onClick={() => deleteSource.mutate(source.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-[var(--color-negative-500)]" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}