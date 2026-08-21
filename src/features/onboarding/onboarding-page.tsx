import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, Wallet, MessageSquare, UploadCloud, Check, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useUpdateProfile } from '@/features/settings/hooks'
import { useCreateAccount } from '@/features/accounts/hooks'
import { useSmsApiKey, useGenerateSmsApiKey } from '@/features/sms/hooks'
import { supabase } from '@/lib/supabase/client'

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']

export function OnboardingPage() {
  const navigate = useNavigate()
  const updateProfile = useUpdateProfile()
  const createAccount = useCreateAccount()
  const { data: smsApiKey } = useSmsApiKey()
  const generateSmsKey = useGenerateSmsApiKey()

  const [step, setStep] = useState(0)
  const [currency, setCurrency] = useState('INR')
  const [accountName, setAccountName] = useState('')
  const [accountType, setAccountType] = useState<'bank' | 'cash' | 'wallet'>('bank')
  const [openingBalance, setOpeningBalance] = useState('0')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const steps = [
    { title: 'Base currency', icon: Sparkles },
    { title: 'First account', icon: Wallet },
    { title: 'SMS tracking (optional)', icon: MessageSquare },
    { title: 'Import a statement (optional)', icon: UploadCloud },
  ]

  const handleNext = async () => {
    setError(null)
    if (step === 0) {
      // Save currency
      setSaving(true)
      try {
        await updateProfile.mutateAsync({ base_currency: currency })
        setStep(1)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    } else if (step === 1) {
      // Create first account
      if (!accountName.trim()) {
        setError('Enter an account name')
        return
      }
      setSaving(true)
      try {
        await createAccount.mutateAsync({
          name: accountName.trim(),
          type: accountType,
          currency,
          opening_balance: Number(openingBalance) || 0,
        })
        setStep(2)
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    } else if (step === 2) {
      // SMS setup is optional — just move on
      setStep(3)
    } else {
      // Final step — mark onboarding complete
      setSaving(true)
      try {
        const { data: userData } = await supabase.auth.getUser()
        if (userData.user?.id) {
          await supabase
            .from('profiles')
            .update({ onboarded_at: new Date().toISOString() })
            .eq('id', userData.user.id)
        }
        navigate('/dashboard', { replace: true })
      } catch (err) {
        setError((err as Error).message)
      } finally {
        setSaving(false)
      }
    }
  }

  const handleSkip = () => {
    if (step < 3) {
      setStep(step + 1)
    } else {
      // Skip to dashboard
      supabase.auth.getUser().then(({ data }) => {
        if (data.user?.id) {
          supabase
            .from('profiles')
            .update({ onboarded_at: new Date().toISOString() })
            .eq('id', data.user.id)
            .then(() => navigate('/dashboard', { replace: true }))
        }
      })
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-[480px] space-y-6">
        <div className="text-center space-y-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--color-brand-600)] shadow-sm shadow-[var(--color-brand-600)]/25 mx-auto">
            <Sparkles className="h-5 w-5 text-white" />
          </div>
          <h1 className="font-display text-2xl font-semibold">Welcome to Ledger</h1>
          <p className="text-sm text-muted">Let's get you set up in a few quick steps.</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center justify-center gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? 'w-8 bg-[var(--color-brand-500)]' : i < step ? 'w-4 bg-[var(--color-positive-500)]' : 'w-4 bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)]'
              }`}
            />
          ))}
        </div>

        <Card>
          <CardContent className="pt-6 space-y-5">
            {/* Step 0: Currency */}
            {step === 0 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="currency">Base currency</Label>
                  <Select id="currency" value={currency} onChange={(e) => setCurrency(e.target.value)} className="mt-1">
                    {CURRENCIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </Select>
                  <p className="text-xs text-muted mt-1.5">Used for all your balances and reports. You can change this later in Settings.</p>
                </div>
              </div>
            )}

            {/* Step 1: First account */}
            {step === 1 && (
              <div className="space-y-4">
                <div>
                  <Label htmlFor="accountName">Account name</Label>
                  <Input
                    id="accountName"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="e.g. HDFC Savings"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="accountType">Account type</Label>
                  <Select id="accountType" value={accountType} onChange={(e) => setAccountType(e.target.value as typeof accountType)} className="mt-1">
                    <option value="bank">Bank account</option>
                    <option value="cash">Cash</option>
                    <option value="wallet">Wallet (UPI / Paytm)</option>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="openingBalance">Opening balance</Label>
                  <Input
                    id="openingBalance"
                    type="number"
                    step="0.01"
                    value={openingBalance}
                    onChange={(e) => setOpeningBalance(e.target.value)}
                    className="mt-1 num"
                  />
                  <p className="text-xs text-muted mt-1.5">The balance this account started with. You can add more accounts later.</p>
                </div>
              </div>
            )}

            {/* Step 2: SMS tracking */}
            {step === 2 && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Auto-track bank/UPI SMS from your Android phone. This is optional — you can set it up later from
                  Settings → SMS Tracking.
                </p>
                {!smsApiKey && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => generateSmsKey.mutate()}
                    disabled={generateSmsKey.isPending}
                  >
                    {generateSmsKey.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MessageSquare className="h-3.5 w-3.5" />}
                    Generate SMS API key
                  </Button>
                )}
                {smsApiKey && (
                  <div className="rounded-lg surface-2 border border-hairline p-3 text-sm">
                    <p className="flex items-center gap-1.5 text-[var(--color-positive-600)]">
                      <Check className="h-4 w-4" />
                      SMS tracking is ready
                    </p>
                    <p className="text-xs text-muted mt-1">
                      Install the Ledger SMS app on your Android phone and enter your API key to start auto-forwarding.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Import statement */}
            {step === 3 && (
              <div className="space-y-4">
                <p className="text-sm text-muted">
                  Import a bank or credit-card statement to skip manual entry. This is optional — you can do it anytime
                  from the Imports page.
                </p>
                <Button variant="secondary" size="sm" onClick={() => navigate('/imports')}>
                  <UploadCloud className="h-3.5 w-3.5" />
                  Go to Imports
                </Button>
              </div>
            )}

            {error && <p className="text-sm text-[var(--color-negative-600)]">{error}</p>}

            <div className="flex items-center justify-between pt-2">
              {step > 0 ? (
                <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back
                </Button>
              ) : <span />}
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleSkip}>
                  Skip
                </Button>
                <Button size="sm" onClick={handleNext} disabled={saving}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {step === 3 ? 'Finish' : 'Continue'}
                  {!saving && <ArrowRight className="h-3.5 w-3.5" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}