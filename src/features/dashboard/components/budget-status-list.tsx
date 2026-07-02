import { Link } from 'react-router-dom'
import { PiggyBank } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useBudgetsWithSpend } from '@/features/budgets/hooks'

function currentPeriodMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function BudgetStatusList() {
  const { data: budgets, isLoading } = useBudgetsWithSpend(currentPeriodMonth())
  const topBudgets = budgets?.slice(0, 4)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget status</CardTitle>
        <Link to="/budgets" className="text-xs font-medium text-[var(--color-brand-500)] hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading &&
          Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-10" />)}

        {!isLoading && topBudgets?.length === 0 && (
          <EmptyState icon={PiggyBank} title="No budgets set" description="Set a monthly limit to see progress here." />
        )}

        {topBudgets?.map((b) => {
          const pct = b.amount_limit > 0 ? Math.round((b.spent / b.amount_limit) * 100) : 0
          const over = pct > 100
          return (
            <div key={b.id} className="flex items-center gap-3">
              <ProgressRing
                value={Math.min(100, pct)}
                size={40}
                strokeWidth={4}
                color={over ? 'var(--color-negative-500)' : (b.category?.color ?? 'var(--color-brand-500)')}
              >
                <span className="text-[10px] font-medium num">{pct}%</span>
              </ProgressRing>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.category?.name ?? 'Uncategorized'}</p>
                <p className={cn('text-xs num', over ? 'text-[var(--color-negative-600)]' : 'text-muted')}>
                  {formatCurrency(b.spent)} of {formatCurrency(b.amount_limit)}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
