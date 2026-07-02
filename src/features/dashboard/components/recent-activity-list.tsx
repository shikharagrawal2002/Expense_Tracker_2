import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency, cn } from '@/lib/utils'
import { mockActivity } from '@/features/dashboard/mock-data'

export function RecentActivityList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent activity</CardTitle>
        <Link to="/transactions" className="text-xs font-medium text-[var(--color-brand-500)] hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-1">
        {mockActivity.map((txn) => (
          <div
            key={txn.id}
            className="flex items-center gap-3 rounded-lg px-2 py-2 -mx-2 hover:surface-2 transition-colors"
          >
            <div
              className="h-8 w-8 rounded-full shrink-0"
              style={{ backgroundColor: `${txn.color}26` }}
            >
              <div className="h-full w-full flex items-center justify-center">
                <div className="h-2 w-2 rounded-full" style={{ backgroundColor: txn.color }} />
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{txn.merchant}</p>
              <p className="text-xs text-muted">{txn.category} · {txn.date}</p>
            </div>
            <p
              className={cn(
                'text-sm font-medium num shrink-0',
                txn.amount > 0 ? 'text-[var(--color-positive-600)]' : 'text-inherit',
              )}
            >
              {txn.amount > 0 ? '+' : ''}
              {formatCurrency(txn.amount)}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
