import { useState } from 'react'
import { Plus, ArrowLeftRight, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { useTransactions } from '@/features/transactions/hooks'
import { useAccounts } from '@/features/accounts/hooks'
import { TransactionRow } from '@/features/transactions/transaction-row'
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog'
import type { Transaction } from '@/lib/supabase/types'

export function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<Transaction['type'] | ''>('')

  const { data: accounts } = useAccounts()
  const {
    data: transactions,
    isLoading,
    isError,
  } = useTransactions({
    search: search || undefined,
    accountId: accountId || undefined,
    type: type || undefined,
  })

  return (
    <div className="max-w-[1000px] space-y-5">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-semibold">Transactions</h1>
        <TransactionFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          }
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full h-10 rounded-lg surface-2 border border-hairline pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
          />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="sm:w-40">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </Select>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="sm:w-48">
          <option value="">All accounts</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          )}

          {isError && (
            <EmptyState
              icon={ArrowLeftRight}
              title="Couldn't load transactions"
              description="Check your Supabase connection in .env.local, then refresh."
            />
          )}

          {!isLoading && !isError && transactions?.length === 0 && (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transactions found"
              description={
                search || accountId || type
                  ? 'Try adjusting your filters.'
                  : 'Add your first transaction to start building your history.'
              }
            />
          )}

          {!isLoading && transactions && transactions.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {transactions.map((txn) => (
                <TransactionRow key={txn.id} txn={txn} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
