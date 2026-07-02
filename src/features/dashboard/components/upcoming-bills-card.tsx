import { CreditCard, Repeat, ReceiptText } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { mockBills } from '@/features/dashboard/mock-data'

const ICONS = { credit_due: CreditCard, subscription: Repeat, bill: ReceiptText }

export function UpcomingBillsCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Upcoming bills</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {mockBills.map((bill) => {
          const Icon = ICONS[bill.kind]
          const urgent = bill.dueInDays <= 3
          return (
            <div key={bill.id} className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-2 border border-hairline shrink-0">
                <Icon className="h-4 w-4 text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{bill.label}</p>
                <p className="text-xs num text-muted">{formatCurrency(bill.amount)}</p>
              </div>
              <Badge variant={urgent ? 'warning' : 'default'}>
                {bill.dueInDays === 0 ? 'Today' : `${bill.dueInDays}d`}
              </Badge>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
