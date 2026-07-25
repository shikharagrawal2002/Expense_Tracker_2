import { Link } from 'react-router-dom'
import { ArrowLeftRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useTransactions } from '@/features/transactions/hooks'
import { TransactionRow } from '@/features/transactions/transaction-row'

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

        {/* No viewAccountId here — this is an all-accounts view, so a transfer
            has no single "correct" sign to show; TransactionRow already
            handles that by rendering it unsigned/neutral in that case. */}
        {recent?.map((txn) => (
          <TransactionRow key={txn.id} txn={txn} />
        ))}
      </CardContent>
    </Card>
  )
}
