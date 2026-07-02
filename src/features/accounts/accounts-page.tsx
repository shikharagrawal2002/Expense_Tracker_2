import { Plus, Wallet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useAccounts } from '@/features/accounts/hooks'
import { AccountCard } from '@/features/accounts/account-card'
import { AccountFormDialog } from '@/features/accounts/account-form-dialog'
import { formatCurrency } from '@/lib/utils'

export function AccountsPage() {
  const { data: accounts, isLoading, isError } = useAccounts()

  const netWorth = accounts?.reduce((sum, a) => sum + a.current_balance, 0) ?? 0

  return (
    <div className="max-w-[1400px] space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Accounts</h1>
          {!isLoading && accounts && accounts.length > 0 && (
            <p className="text-sm text-muted mt-0.5 num">
              Net worth across accounts: <span className="font-medium">{formatCurrency(netWorth)}</span>
            </p>
          )}
        </div>
        <AccountFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add account
            </Button>
          }
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <div className="surface border border-hairline rounded-2xl">
          <EmptyState
            icon={Wallet}
            title="Couldn't load accounts"
            description="Check your Supabase connection in .env.local, then refresh."
          />
        </div>
      )}

      {!isLoading && !isError && accounts?.length === 0 && (
        <div className="surface border border-hairline rounded-2xl">
          <EmptyState
            icon={Wallet}
            title="No accounts yet"
            description="Add your first bank account, card, or wallet to start tracking transactions."
          />
        </div>
      )}

      {!isLoading && accounts && accounts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {accounts.map((account) => (
            <AccountCard key={account.id} account={account} />
          ))}
        </div>
      )}
    </div>
  )
}
