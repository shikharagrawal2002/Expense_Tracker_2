import { Trash2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { formatCurrency, cn } from '@/lib/utils'
import { getCategoryIcon } from '@/features/categories/category-meta'
import { useDeleteBudget } from '@/features/budgets/hooks'

interface BudgetCardProps {
  id: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  spent: number
  limit: number
  alertThresholdPct: number
}

export function BudgetCard({ id, categoryName, categoryIcon, categoryColor, spent, limit, alertThresholdPct }: BudgetCardProps) {
  const deleteBudget = useDeleteBudget()
  const Icon = getCategoryIcon(categoryIcon)
  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
  const isOver = pct > 100
  const isNearLimit = pct >= alertThresholdPct && !isOver

  const ringColor = isOver
    ? 'var(--color-negative-500)'
    : isNearLimit
      ? 'var(--color-warning-500)'
      : categoryColor

  return (
    <Card className="group relative">
      <button
        onClick={() => deleteBudget.mutate(id)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-all"
        aria-label={`Remove ${categoryName} budget`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <CardContent className="pt-5 flex items-center gap-4">
        <ProgressRing value={pct} size={64} strokeWidth={6} color={ringColor}>
          <Icon className="h-5 w-5" style={{ color: categoryColor }} />
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{categoryName}</p>
          <p className={cn('text-xs num mt-0.5', isOver ? 'text-[var(--color-negative-600)]' : 'text-muted')}>
            {formatCurrency(spent)} of {formatCurrency(limit)}
          </p>
          <p className="text-xs num text-muted mt-0.5">{pct}% used</p>
        </div>
      </CardContent>
    </Card>
  )
}
