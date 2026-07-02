import { TrendingUp, TrendingDown, CreditCard, Activity } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactCurrency, cn } from '@/lib/utils'
import { useDashboardKpis } from '@/features/dashboard/use-dashboard-data'

export function KpiRow() {
  const { data, isLoading } = useDashboardKpis()

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
    )
  }

  const { netWorth, currentMonthNet, savingsRate, creditUtilization, healthScore } = data
  const isPositiveNet = currentMonthNet >= 0

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* Financial health score — signature ring, larger emphasis */}
      <Card>
        <CardContent className="pt-5 flex items-center gap-4">
          <ProgressRing
            value={healthScore}
            size={72}
            strokeWidth={7}
            color={healthScore >= 70 ? 'var(--color-positive-500)' : healthScore >= 40 ? 'var(--color-warning-500)' : 'var(--color-negative-500)'}
          >
            <span className="font-display text-lg font-semibold num">{healthScore}</span>
          </ProgressRing>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Health score</p>
            <p className="text-sm mt-1 text-muted">
              {healthScore >= 70 ? 'Good shape' : healthScore >= 40 ? 'Room to improve' : 'Needs attention'}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Net worth</p>
            <div
              className={cn(
                'flex items-center gap-0.5 text-xs font-medium',
                isPositiveNet ? 'text-[var(--color-positive-600)]' : 'text-[var(--color-negative-600)]',
              )}
            >
              {isPositiveNet ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {formatCompactCurrency(Math.abs(currentMonthNet))}
            </div>
          </div>
          <p className="font-display text-2xl font-semibold mt-2 num">{formatCompactCurrency(netWorth)}</p>
          <p className="text-xs text-muted mt-1">{isPositiveNet ? 'net gain' : 'net loss'} this month</p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Savings rate</p>
            <Activity className="h-3.5 w-3.5 text-muted" />
          </div>
          <p className="font-display text-2xl font-semibold mt-2 num">{savingsRate}%</p>
          <div className="h-1.5 rounded-full surface-2 mt-3 overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--color-positive-500)]"
              style={{ width: `${Math.min(100, Math.max(0, savingsRate))}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Credit utilization</p>
            <CreditCard className="h-3.5 w-3.5 text-muted" />
          </div>
          <p className="font-display text-2xl font-semibold mt-2 num">{creditUtilization}%</p>
          <div className="h-1.5 rounded-full surface-2 mt-3 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full',
                creditUtilization < 30 ? 'bg-[var(--color-positive-500)]' : 'bg-[var(--color-warning-500)]',
              )}
              style={{ width: `${creditUtilization}%` }}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
