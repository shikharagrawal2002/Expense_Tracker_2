import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Badge, Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useBudgetsWithSpend } from '@/features/budgets/hooks'
import { Target } from 'lucide-react'

function currentPeriodMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function BudgetVsActualChart() {
  const periodMonth = currentPeriodMonth()
  const { data: budgets, isLoading } = useBudgetsWithSpend(periodMonth)
  const monthLabel = new Date(`${periodMonth}T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget vs actual — {monthLabel}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-6" />
            ))}
          </div>
        )}

        {!isLoading && budgets?.length === 0 && (
          <EmptyState
            icon={Target}
            title="No budgets set for this month"
            description="Set a monthly limit per category under Budgets to see how you're tracking here."
          />
        )}

        {!isLoading &&
          budgets?.map((b) => {
            const pct = b.amount_limit > 0 ? (b.spent / b.amount_limit) * 100 : 0
            const isOver = pct > 100
            const isNear = pct >= 80 && pct <= 100
            const fillColor = isOver
              ? 'var(--color-negative-500)'
              : isNear
                ? 'var(--color-warning-500)'
                : (b.category?.color ?? 'var(--color-brand-500)')
            const badgeVariant = isOver ? 'negative' : isNear ? 'warning' : 'positive'

            // Scale the whole bar to whatever's larger — so an over-budget
            // category visibly extends past the 100% marker instead of just
            // capping at the container's edge (matches the design concept's
            // "110%" example, where the fill clearly overshoots the dashed line).
            const scale = Math.max(120, pct + 15)
            const fillWidthPct = (Math.min(pct, scale) / scale) * 100
            const markerLeftPct = (100 / scale) * 100

            return (
              <div key={b.id} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-sm truncate">{b.category?.name ?? 'Uncategorized'}</span>
                <div className="relative flex-1 h-5 rounded surface-2 overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded transition-all"
                    style={{ width: `${fillWidthPct}%`, backgroundColor: fillColor, opacity: 0.85 }}
                  />
                  <div
                    className="absolute inset-y-0 border-r-2 border-dashed border-white/40"
                    style={{ left: `${markerLeftPct}%` }}
                  />
                </div>
                <span className="w-32 shrink-0 text-right text-xs num text-muted">
                  {formatCurrency(b.spent)}/{formatCurrency(b.amount_limit)}
                </span>
                <Badge variant={badgeVariant} className="w-14 justify-center shrink-0">
                  {Math.round(pct)}%
                </Badge>
              </div>
            )
          })}

        {!isLoading && budgets && budgets.length > 0 && (
          <p className={cn('text-xs text-muted pt-1')}>Dashed line marks 100% of budget · red = over budget.</p>
        )}
      </CardContent>
    </Card>
  )
}
