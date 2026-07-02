import { useEffect, useState } from 'react'
import { Sun, Moon, Monitor, LogOut, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useTheme } from '@/lib/hooks/useTheme'
import { useAuth } from '@/features/auth/use-auth'
import { useProfile, useUpdateProfile } from '@/features/settings/hooks'

const THEME_OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
] as const

const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP', 'AED', 'SGD']

export function SettingsPage() {
  const { user, signOut } = useAuth()
  const { theme, setTheme } = useTheme()
  const { data: profile } = useProfile()
  const updateProfile = useUpdateProfile()

  const [fullName, setFullName] = useState('')
  const [currency, setCurrency] = useState('INR')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name ?? '')
      setCurrency(profile.base_currency)
    }
  }, [profile])

  const saveProfile = async () => {
    await updateProfile.mutateAsync({ full_name: fullName, base_currency: currency })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div className="max-w-[700px] space-y-6">
      <h1 className="font-display text-2xl font-semibold">Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fullName">Full name</Label>
            <Input id="fullName" value={fullName} onChange={(e) => setFullName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user?.email ?? ''} disabled />
          </div>
          <Button onClick={saveProfile} disabled={updateProfile.isPending} size="sm">
            {updateProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            {saved ? 'Saved' : 'Save changes'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferences</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <div>
            <Label>Theme</Label>
            <div className="grid grid-cols-3 gap-1.5 surface-2 rounded-lg p-1 max-w-xs">
              {THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setTheme(opt.value)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-md py-1.5 text-sm font-medium transition-colors',
                    theme === opt.value ? 'surface shadow-sm' : 'text-muted',
                  )}
                >
                  <opt.icon className="h-3.5 w-3.5" />
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label htmlFor="currency">Base currency</Label>
            <select
              id="currency"
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className="h-10 rounded-lg surface-2 border border-hairline px-3 text-sm max-w-[160px]"
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => signOut()}>
            <LogOut className="h-4 w-4" />
            Sign out
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
