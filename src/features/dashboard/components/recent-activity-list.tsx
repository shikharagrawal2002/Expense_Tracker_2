import { Link } from 'react-router-dom'
import { ArrowLeftRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useTransactions } from '@/features/transactions/hooks'

export function RecentActivityList() {
  const { data: transactions, isLoading } = useTransactions()
  const recent = transactions?.slice(0, 6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <Link to="/transactions" className="text-xs font-medium text-[var(--color-brand-500)] hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {isLoading && Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}

        {!isLoading && recent?.length === 0 && (
          <EmptyState icon={ArrowLeftRight} title="No activity yet" description="Transactions you add will show up here." />
        )}

        {recent?.map((txn) => {
          const signedAmount = txn.type === 'income' ? txn.amount : txn.type === 'expense' ? -txn.amount : txn.amount
          const color = txn.category?.color ?? '#94a3b8'
          return (
            <div
              key={txn.id}
              className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:surface-2 transition-colors"
            >
              <div className="h-8 w-8 rounded-full shrink-0" style={{ backgroundColor: `${color}26` }}>
                <div className="h-full w-full flex items-center justify-center">
                  <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{txn.category?.name ?? 'Uncategorized'}</p>
                <p className="text-xs text-muted">
                  {txn.account?.name} ·{' '}
                  {new Date(txn.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </p>
              </div>
              <p
                className={cn(
                  'text-sm font-medium num shrink-0',
                  signedAmount > 0 ? 'text-[var(--color-positive-600)]' : 'text-inherit',
                )}
              >
                {signedAmount > 0 ? '+' : ''}
                {formatCurrency(signedAmount)}
              </p>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
