import { Link } from 'react-router-dom'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { formatCurrency, cn } from '@/lib/utils'
import { mockBudgets } from '@/features/dashboard/mock-data'

export function BudgetStatusList() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Budget status</CardTitle>
        <Link to="/budgets" className="text-xs font-medium text-[var(--color-brand-500)] hover:underline">
          View all
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {mockBudgets.map((b) => {
          const pct = Math.round((b.spent / b.limit) * 100)
          const over = pct > 100
          return (
            <div key={b.id} className="flex items-center gap-3">
              <ProgressRing
                value={pct}
                size={40}
                strokeWidth={4}
                color={over ? 'var(--color-negative-500)' : b.color}
              >
                <span className="text-[10px] font-medium num">{pct}%</span>
              </ProgressRing>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{b.category}</p>
                <p className={cn('text-xs num', over ? 'text-[var(--color-negative-600)]' : 'text-muted')}>
                  {formatCurrency(b.spent)} of {formatCurrency(b.limit)}
                </p>
              </div>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
