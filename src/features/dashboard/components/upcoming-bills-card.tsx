import { CreditCard, Repeat, ReceiptText } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils'
import { useUpcomingDues } from '@/features/dashboard/use-dashboard-data'
import { daysUntil } from '@/features/recurring/api'

export function UpcomingBillsCard() {
  const { data: dues, isLoading } = useUpcomingDues(4)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming bills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}

        {!isLoading && dues?.length === 0 && (
          <EmptyState icon={ReceiptText} title="Nothing due soon" description="Add bills or subscriptions to see reminders here." />
        )}

        {dues?.map((item) => {
          const Icon = item.is_subscription ? Repeat : item.is_bill ? ReceiptText : CreditCard
          const days = daysUntil(item.next_due_date)
          const urgent = days <= 3
          return (
            <div key={item.id} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-2 border border-hairline shrink-0">
                <Icon className="h-4 w-4 text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.label}</p>
                <p className="text-xs num text-muted">{formatCurrency(item.amount)}</p>
              </div>
              <Badge variant={urgent ? 'warning' : 'default'}>{days <= 0 ? 'Due' : `${days}d`}</Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
