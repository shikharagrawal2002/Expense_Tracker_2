import { useState } from 'react'
import { Zap, ShieldCheck, Trash2, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

interface MerchantRule {
  id: string
  user_id: string
  matcher: string
  merchant: string
  category_id: string | null
  account_id: string | null
  confidence: number
  times_confirmed: number
  auto_confirm: boolean
  amount_min: number | null
  amount_max: number | null
  is_credit: boolean
  created_at: string
  updated_at: string
}

interface AutomationSettings {
  auto_confirm_enabled: boolean
  auto_confirm_amount_ceiling: number
  auto_confirm_min_confirmations: number
  auto_confirm_credits: boolean
}

const RULES_KEY = ['merchant-rules'] as const
const SETTINGS_KEY = ['automation-settings'] as const

async function fetchMerchantRules(): Promise<MerchantRule[]> {
  const { data, error } = await supabase
    .from('merchant_rules')
    .select('*')
    .order('times_confirmed', { ascending: false })
  if (error) throw error
  return data as MerchantRule[]
}

async function fetchAutomationSettings(): Promise<AutomationSettings> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.id) throw new Error('Not authenticated')
  const { data, error } = await supabase
    .from('profiles')
    .select('auto_confirm_enabled, auto_confirm_amount_ceiling, auto_confirm_min_confirmations, auto_confirm_credits')
    .eq('id', userData.user.id)
    .single()
  if (error) throw error
  return data as AutomationSettings
}

async function updateAutomationSettings(patch: Partial<AutomationSettings>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  if (!userData.user?.id) throw new Error('Not authenticated')
  const { error } = await supabase.from('profiles').update(patch).eq('id', userData.user.id)
  if (error) throw error
}

async function deleteMerchantRule(id: string): Promise<void> {
  const { error } = await supabase.from('merchant_rules').delete().eq('id', id)
  if (error) throw error
}

async function toggleMerchantRule(id: string, autoConfirm: boolean): Promise<void> {
  const { error } = await supabase.from('merchant_rules').update({ auto_confirm: autoConfirm }).eq('id', id)
  if (error) throw error
}

export function AutomationPage() {
  const queryClient = useQueryClient()
  const { data: rules = [] } = useQuery({ queryKey: RULES_KEY, queryFn: fetchMerchantRules })
  const { data: settings } = useQuery({ queryKey: SETTINGS_KEY, queryFn: fetchAutomationSettings })

  const updateSettings = useMutation({
    mutationFn: (patch: Partial<AutomationSettings>) => updateAutomationSettings(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SETTINGS_KEY }),
  })
  const deleteRule = useMutation({
    mutationFn: (id: string) => deleteMerchantRule(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  })
  const toggleRule = useMutation({
    mutationFn: ({ id, autoConfirm }: { id: string; autoConfirm: boolean }) => toggleMerchantRule(id, autoConfirm),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: RULES_KEY }),
  })

  const [ceiling, setCeiling] = useState('5000')
  const [minConfirmations, setMinConfirmations] = useState('3')

  const enabled = settings?.auto_confirm_enabled ?? false
  const credits = settings?.auto_confirm_credits ?? false

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Automation</h1>
        <p className="text-sm text-muted mt-0.5">
          Let Ledger learn from your confirmations and auto-post trusted SMS transactions.
        </p>
      </div>

      {/* Master toggle */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-[var(--color-warning-500)]" />
            Auto-confirm
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Auto-post high-confidence SMS</p>
              <p className="text-xs text-muted">
                When a message matches a learned rule with enough confirmations, it posts straight to your ledger.
              </p>
            </div>
            <button
              onClick={() => updateSettings.mutate({ auto_confirm_enabled: !enabled })}
              className={cn('rounded-lg p-1.5 transition-colors', enabled ? 'text-[var(--color-positive-600)]' : 'text-muted')}
              aria-label={enabled ? 'Disable auto-confirm' : 'Enable auto-confirm'}
            >
              {enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-hairline pt-4">
            <div>
              <Label htmlFor="ceiling">Amount ceiling (₹)</Label>
              <Input
                id="ceiling"
                type="number"
                value={ceiling}
                onChange={(e) => setCeiling(e.target.value)}
                onBlur={() => {
                  const val = Number(ceiling)
                  if (!Number.isNaN(val) && val > 0) updateSettings.mutate({ auto_confirm_amount_ceiling: val })
                }}
                className="mt-1 num"
              />
              <p className="text-xs text-muted mt-1">Nothing above this amount auto-posts.</p>
            </div>
            <div>
              <Label htmlFor="minConfirmations">Min confirmations</Label>
              <Input
                id="minConfirmations"
                type="number"
                value={minConfirmations}
                onChange={(e) => setMinConfirmations(e.target.value)}
                onBlur={() => {
                  const val = Number(minConfirmations)
                  if (!Number.isNaN(val) && val >= 1) updateSettings.mutate({ auto_confirm_min_confirmations: val })
                }}
                className="mt-1 num"
              />
              <p className="text-xs text-muted mt-1">A merchant must be confirmed this many times before auto-posting.</p>
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-hairline pt-4">
            <div>
              <p className="text-sm font-medium">Auto-confirm credits</p>
              <p className="text-xs text-muted">By default only debits auto-post. Enable to also auto-post credits.</p>
            </div>
            <button
              onClick={() => updateSettings.mutate({ auto_confirm_credits: !credits })}
              className={cn('rounded-lg p-1.5 transition-colors', credits ? 'text-[var(--color-positive-600)]' : 'text-muted')}
              aria-label={credits ? 'Disable credit auto-confirm' : 'Enable credit auto-confirm'}
            >
              {credits ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Learned rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-positive-600)]" />
            Learned merchant rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rules.length === 0 && (
            <p className="text-sm text-muted py-4">
              No rules yet. Every time you confirm an SMS or import, Ledger learns a rule for that merchant.
            </p>
          )}
          {rules.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {rules.map((rule) => (
                <div key={rule.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{rule.merchant}</p>
                    <p className="text-xs text-muted truncate">
                      Matcher: <code className="num">{rule.matcher}</code> · Confirmed {rule.times_confirmed}× ·{' '}
                      {rule.amount_min != null && rule.amount_max != null
                        ? `₹${rule.amount_min.toLocaleString('en-IN')}–₹${rule.amount_max.toLocaleString('en-IN')}`
                        : 'Any amount'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant={rule.auto_confirm ? 'positive' : 'default'}>
                      {rule.auto_confirm ? 'Auto' : 'Manual'}
                    </Badge>
                    <button
                      onClick={() => toggleRule.mutate({ id: rule.id, autoConfirm: !rule.auto_confirm })}
                      className={cn('rounded-lg p-1.5 transition-colors', rule.auto_confirm ? 'text-[var(--color-positive-600)]' : 'text-muted')}
                      aria-label={rule.auto_confirm ? 'Disable auto-confirm' : 'Enable auto-confirm'}
                    >
                      {rule.auto_confirm ? <ToggleRight className="h-5 w-5" /> : <ToggleLeft className="h-5 w-5" />}
                    </button>
                    <button
                      onClick={() => deleteRule.mutate(rule.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-[var(--color-negative-500)]/10 hover:text-[var(--color-negative-600)] transition-colors"
                      aria-label={`Delete rule for ${rule.merchant}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}