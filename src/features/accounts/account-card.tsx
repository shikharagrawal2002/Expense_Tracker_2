import { MoreHorizontal, Archive } from 'lucide-react'
import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency, cn } from '@/lib/utils'
import { ACCOUNT_TYPE_META } from '@/features/accounts/account-meta'
import { useArchiveAccount } from '@/features/accounts/hooks'
import type { Account } from '@/lib/supabase/types'

export function AccountCard({ account }: { account: Account }) {
  const meta = ACCOUNT_TYPE_META[account.type]
  const Icon = meta.icon
  const archiveAccount = useArchiveAccount()
  const isNegative = account.current_balance < 0

  return (
    <Card>
      <CardContent className="pt-5">
        <div className="flex items-start justify-between mb-3">
          <div
            className="h-10 w-10 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: `${meta.color}1f` }}
          >
            <Icon className="h-5 w-5" style={{ color: meta.color }} />
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="rounded-lg p-1.5 hover:surface-2 text-muted" aria-label="Account options">
                <MoreHorizontal className="h-4 w-4" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="end"
                className="surface border border-hairline rounded-lg shadow-lg p-1 min-w-[140px] z-50"
              >
                <DropdownMenu.Item
                  onSelect={() => archiveAccount.mutate(account.id)}
                  className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:surface-2 cursor-pointer outline-none text-[var(--color-negative-600)]"
                >
                  <Archive className="h-3.5 w-3.5" />
                  Archive
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
        <p className="text-sm font-medium truncate">{account.name}</p>
        <p className="text-xs text-muted mb-2">{meta.label}</p>
        <p className={cn('font-display text-xl font-semibold num', isNegative && 'text-[var(--color-negative-600)]')}>
          {formatCurrency(account.current_balance, account.currency)}
        </p>
        {account.type === 'credit_card' && account.credit_limit && (
          <div className="mt-3">
            <div className="h-1.5 rounded-full surface-2 overflow-hidden">
              <div
                className="h-full rounded-full bg-[var(--color-warning-500)]"
                style={{
                  width: `${Math.min(100, (Math.abs(account.current_balance) / account.credit_limit) * 100)}%`,
                }}
              />
            </div>
            <p className="text-xs text-muted mt-1.5">Limit {formatCurrency(account.credit_limit, account.currency)}</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
