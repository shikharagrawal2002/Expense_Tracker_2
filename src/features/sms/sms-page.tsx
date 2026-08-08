import { useState } from 'react'
import { Link } from 'react-router-dom'
import { MessageSquare, Check, X, ArrowDownToLine, ArrowUpFromLine, Settings } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Badge } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { usePendingSms, useConfirmSms, useSkipSms, useSmsHistory } from '@/features/sms/hooks'
import { useAccounts } from '@/features/accounts/hooks'
import { useCategories } from '@/features/categories/hooks'
import type { SmsTransaction } from '@/lib/supabase/types'

export function SmsPage() {
  const [tab, setTab] = useState<'pending' | 'history'>('pending')
  const { data: pending, isLoading: pendingLoading } = usePendingSms()
  const { data: history, isLoading: historyLoading } = useSmsHistory()
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const confirmSms = useConfirmSms()
  const skipSms = useSkipSms()

  const [selectedAccount, setSelectedAccount] = useState<Record<string, string>>({})
  const [selectedCategory, setSelectedCategory] = useState<Record<string, string>>({})

  const isLoading = tab === 'pending' ? pendingLoading : historyLoading
  const items = tab === 'pending' ? pending : history

  return (
    <div className="max-w-[1000px] space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">SMS Transactions</h1>
          <p className="text-sm text-muted mt-0.5">
            Bank/UPI SMS forwarded from your phone. Review and confirm to add them as transactions.
          </p>
        </div>
        <div className="flex gap-2">
          <Link to="/sms/settings">
            <Button variant="secondary" size="sm">
              <Settings className="h-3.5 w-3.5" />
              Setup
            </Button>
          </Link>
          <Button
            variant={tab === 'pending' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setTab('pending')}
          >
            Pending {pending && pending.length > 0 && `(${pending.length})`}
          </Button>
          <Button
            variant={tab === 'history' ? 'default' : 'secondary'}
            size="sm"
            onClick={() => setTab('history')}
          >
            History
          </Button>
        </div>
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {!isLoading && items?.length === 0 && (
        <Card>
          <CardContent>
            <EmptyState
              icon={MessageSquare}
              title={tab === 'pending' ? 'No pending SMS' : 'No SMS history yet'}
              description={
                tab === 'pending'
                  ? 'Install the Ledger SMS app on your Android phone to start auto-tracking bank/UPI transactions.'
                  : 'Confirmed and skipped SMS messages will appear here.'
              }
            />
          </CardContent>
        </Card>
      )}

      {!isLoading && items && items.length > 0 && (
        <div className="space-y-3">
          {items.map((sms) => (
            <SmsCard
              key={sms.id}
              sms={sms}
              accounts={accounts ?? []}
              categories={categories ?? []}
              selectedAccount={selectedAccount[sms.id] ?? sms.account_id ?? ''}
              selectedCategory={selectedCategory[sms.id] ?? ''}
              onAccountChange={(id) => setSelectedAccount((prev) => ({ ...prev, [sms.id]: id }))}
              onCategoryChange={(id) => setSelectedCategory((prev) => ({ ...prev, [sms.id]: id }))}
              onConfirm={() => {
                const accountId = selectedAccount[sms.id] ?? sms.account_id
                if (!accountId) return
                confirmSms.mutate({
                  smsId: sms.id,
                  accountId,
                  categoryId: selectedCategory[sms.id] || undefined,
                })
              }}
              onSkip={() => skipSms.mutate(sms.id)}
              isConfirming={confirmSms.isPending}
              isSkipping={skipSms.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function SmsCard({
  sms,
  accounts,
  categories,
  selectedAccount,
  selectedCategory,
  onAccountChange,
  onCategoryChange,
  onConfirm,
  onSkip,
  isConfirming,
  isSkipping,
}: {
  sms: SmsTransaction
  accounts: Array<{ id: string; name: string }>
  categories: Array<{ id: string; name: string }>
  selectedAccount: string
  selectedCategory: string
  onAccountChange: (id: string) => void
  onCategoryChange: (id: string) => void
  onConfirm: () => void
  onSkip: () => void
  isConfirming: boolean
  isSkipping: boolean
}) {
  const isDebit = sms.type === 'debit'
  const isCredit = sms.type === 'credit'

  return (
    <Card>
      <CardContent className="pt-4">
        <div className="flex items-start gap-4">
          <div
            className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              isDebit
                ? 'bg-[var(--color-negative-500)]/15 text-[var(--color-negative-600)]'
                : isCredit
                  ? 'bg-[var(--color-positive-500)]/15 text-[var(--color-positive-600)]'
                  : 'bg-[var(--color-warning-500)]/15 text-[var(--color-warning-500)]'
            }`}
          >
            {isDebit ? (
              <ArrowDownToLine className="h-5 w-5" />
            ) : isCredit ? (
              <ArrowUpFromLine className="h-5 w-5" />
            ) : (
              <MessageSquare className="h-5 w-5" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-display text-lg font-semibold num">
                  {sms.amount !== null ? formatCurrency(sms.amount) : '—'}
                </span>
                {isDebit && <Badge variant="negative">Debit</Badge>}
                {isCredit && <Badge variant="positive">Credit</Badge>}
                {sms.status === 'duplicate' && <Badge variant="warning">Duplicate</Badge>}
                {sms.status === 'confirmed' && <Badge variant="positive">Confirmed</Badge>}
                {sms.status === 'skipped' && <Badge variant="default">Skipped</Badge>}
              </div>
              <span className="text-xs text-muted">
                {new Date(sms.received_at).toLocaleString('en-IN', {
                  day: 'numeric',
                  month: 'short',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>

            {sms.merchant && <p className="text-sm font-medium mt-0.5">{sms.merchant}</p>}
            {sms.description && <p className="text-sm text-muted mt-0.5">{sms.description}</p>}

            <p className="text-xs text-muted mt-2 bg-[var(--color-surface-2-light)] dark:bg-[var(--color-surface-2-dark)] rounded-lg p-2.5 border border-hairline">
              {sms.raw_text}
            </p>

            <div className="text-xs text-muted mt-2">
              From: <span className="font-medium">{sms.sender_phone}</span>
            </div>

            {sms.status === 'pending' && (
              <div className="flex flex-wrap items-end gap-3 mt-4">
                <div className="min-w-[180px]">
                  <label className="text-xs font-medium text-muted block mb-1">Account</label>
                  <Select value={selectedAccount} onChange={(e) => onAccountChange(e.target.value)}>
                    <option value="">Select account…</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="min-w-[160px]">
                  <label className="text-xs font-medium text-muted block mb-1">Category</label>
                  <Select value={selectedCategory} onChange={(e) => onCategoryChange(e.target.value)}>
                    <option value="">Auto-suggest</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex gap-2 ml-auto">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onSkip}
                    disabled={isSkipping}
                  >
                    <X className="h-3.5 w-3.5" />
                    Skip
                  </Button>
                  <Button
                    size="sm"
                    onClick={onConfirm}
                    disabled={!selectedAccount || isConfirming}
                  >
                    <Check className="h-3.5 w-3.5" />
                    {isConfirming ? 'Saving…' : 'Confirm'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}