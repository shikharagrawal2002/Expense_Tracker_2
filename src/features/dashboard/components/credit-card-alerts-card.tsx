import { CreditCard, AlertTriangle, Gift } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils'
import { useCreditCardAlerts, useTotalRewardPoints } from '@/features/dashboard/use-dashboard-data'

export function CreditCardAlertsCard() {
  const { data: alerts, isLoading } = useCreditCardAlerts()
  const { data: rewardPoints } = useTotalRewardPoints()

  const atRisk = alerts?.filter((a) => a.isDueSoon || a.isHighUtilization) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Credit cards</CardTitle>
        {!!rewardPoints && (
          <span className="flex items-center gap-1 text-xs text-muted">
            <Gift className="h-3.5 w-3.5" />
            {rewardPoints.toLocaleString('en-IN')} pts earned
          </span>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-14" />)}

        {!isLoading && atRisk.length === 0 && (
          <EmptyState
            icon={CreditCard}
            title="No card statements need attention"
            description="You'll see alerts here when a bill is due soon or a card's utilization runs high."
          />
        )}

        {atRisk.map((alert) => (
          <div key={alert.accountId} className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg surface-2 border border-hairline shrink-0">
              <AlertTriangle className="h-4 w-4 text-[var(--color-warning-500)]" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{alert.accountName}</p>
              <p className="text-xs num text-muted">
                {formatCurrency(alert.statementAmount)} due {new Date(alert.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                {alert.minimumDue ? ` · min ${formatCurrency(alert.minimumDue)}` : ''}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1 shrink-0">
              {alert.isDueSoon && <Badge variant="warning">Due soon</Badge>}
              {alert.isHighUtilization && <Badge variant="negative">{alert.utilizationPct}% used</Badge>}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
