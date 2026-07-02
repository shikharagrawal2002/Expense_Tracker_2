import { useState } from 'react'
import { ChevronLeft, ChevronRight, Plus, PiggyBank } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils'
import { useBudgetsWithSpend } from '@/features/budgets/hooks'
import { BudgetCard } from '@/features/budgets/budget-card'
import { BudgetFormDialog } from '@/features/budgets/budget-form-dialog'

function toPeriodMonth(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`
}

function monthLabel(date: Date) {
  return date.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}

export function BudgetsPage() {
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const periodMonth = toPeriodMonth(monthDate)
  const { data: budgets, isLoading, isError } = useBudgetsWithSpend(periodMonth)

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + delta)
      return next
    })
  }

  const totalLimit = budgets?.reduce((sum, b) => sum + b.amount_limit, 0) ?? 0
  const totalSpent = budgets?.reduce((sum, b) => sum + b.spent, 0) ?? 0

  return (
    <div className="max-w-[1100px] space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Budgets</h1>
          {budgets && budgets.length > 0 && (
            <p className="text-sm text-muted mt-0.5 num">
              {formatCurrency(totalSpent)} spent of {formatCurrency(totalLimit)} budgeted
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 surface-2 border border-hairline rounded-lg px-1">
            <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium px-1 min-w-[130px] text-center">{monthLabel(monthDate)}</span>
            <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <BudgetFormDialog
            periodMonth={periodMonth}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4" />
                Set budget
              </Button>
            }
          />
        </div>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <EmptyState icon={PiggyBank} title="Couldn't load budgets" description="Check your Supabase connection and refresh." />
        </Card>
      )}

      {!isLoading && !isError && budgets?.length === 0 && (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title={`No budgets set for ${monthLabel(monthDate)}`}
            description="Set a monthly limit per category to track spending as it happens."
          />
        </Card>
      )}

      {!isLoading && budgets && budgets.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {budgets.map((b) => (
            <BudgetCard
              key={b.id}
              id={b.id}
              categoryName={b.category?.name ?? 'Uncategorized'}
              categoryIcon={b.category?.icon ?? 'tag'}
              categoryColor={b.category?.color ?? '#94a3b8'}
              spent={b.spent}
              limit={b.amount_limit}
              alertThresholdPct={b.alert_threshold_pct}
            />
          ))}
        </div>
      )}
    </div>
  )
}
