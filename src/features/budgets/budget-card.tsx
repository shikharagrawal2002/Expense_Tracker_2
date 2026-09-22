import { useState } from 'react'
import { Pencil, Trash2, AlertTriangle, Loader2 } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Input, Label } from '@/components/ui/input'
import { formatCurrency, cn } from '@/lib/utils'
import { getCategoryIcon } from '@/features/categories/category-meta'
import { useDeleteBudget, useUpdateBudget } from '@/features/budgets/hooks'

export interface BudgetCardProps {
  id: string
  categoryName: string
  categoryIcon: string
  categoryColor: string
  spent: number
  limit: number
  alertThresholdPct: number
}

/** Compact card sized so two fit side-by-side: ring on the left, numbers on the
 *  right. Edit/delete are always visible because touch devices have no hover
 *  state to reveal a hover-only control. */
export function BudgetCard({
  id,
  categoryName,
  categoryIcon,
  categoryColor,
  spent,
  limit,
  alertThresholdPct,
}: BudgetCardProps) {
  const deleteBudget = useDeleteBudget()
  const Icon = getCategoryIcon(categoryIcon)

  const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0
  const isOver = pct > 100
  const isNearLimit = pct >= alertThresholdPct && !isOver
  const remaining = limit - spent

  const ringColor = isOver
    ? 'var(--color-negative-500)'
    : isNearLimit
      ? 'var(--color-warning-500)'
      : categoryColor

  return (
    <Card className="group relative h-full">
      <CardContent className="pt-3.5 px-3.5 sm:pt-4 sm:px-4 flex flex-col gap-2.5 h-full">
        <div className="flex items-center gap-2.5 sm:gap-3">
          <ProgressRing value={pct} size={44} strokeWidth={5} color={ringColor} className="shrink-0">
            <Icon className="h-3.5 w-3.5" style={{ color: categoryColor }} />
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{categoryName}</p>
            <p className={cn('text-[11px] sm:text-xs num mt-0.5 truncate', isOver ? 'text-[var(--color-negative-600)]' : 'text-muted')}>
              {formatCurrency(spent)} / {formatCurrency(limit)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className={cn('text-[11px] sm:text-xs num', isOver ? 'text-[var(--color-negative-600)]' : 'text-muted')}>
              {pct}% used
            </span>
            {(isNearLimit || isOver) && (
              <AlertTriangle
                className={cn(
                  'h-3.5 w-3.5 shrink-0',
                  isOver ? 'text-[var(--color-negative-600)]' : 'text-[var(--color-warning-500)]',
                )}
              />
            )}
          </div>
          <p
            className={cn(
              'text-[11px] sm:text-xs num truncate text-right',
              remaining < 0 ? 'text-[var(--color-negative-600)]' : 'text-muted',
            )}
          >
            {remaining < 0 ? `${formatCurrency(Math.abs(remaining))} over` : `${formatCurrency(remaining)} left`}
          </p>
        </div>

        <div className="mt-auto flex items-center gap-1.5 border-t border-hairline pt-2.5">
          <BudgetEditDialog
            id={id}
            categoryName={categoryName}
            limit={limit}
            alertThresholdPct={alertThresholdPct}
            trigger={
              <Button variant="secondary" size="sm" className="flex-1" aria-label={`Edit ${categoryName} budget`}>
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Edit</span>
              </Button>
            }
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => deleteBudget.mutate(id)}
            disabled={deleteBudget.isPending}
            className="text-muted hover:text-[var(--color-negative-600)] px-2"
            aria-label={`Remove ${categoryName} budget`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

interface BudgetEditDialogProps {
  id: string
  categoryName: string
  limit: number
  alertThresholdPct: number
  trigger: React.ReactNode
}

/** Lets an existing budget's limit and alert threshold be corrected in place —
 *  previously the only way to change a limit was to delete and re-create it. */
export function BudgetEditDialog({ id, categoryName, limit, alertThresholdPct, trigger }: BudgetEditDialogProps) {
  const [open, setOpen] = useState(false)
  const [amountLimit, setAmountLimit] = useState(String(limit))
  const [threshold, setThreshold] = useState(String(alertThresholdPct))
  const [error, setError] = useState<string | null>(null)
  const updateBudget = useUpdateBudget()

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const parsedLimit = Number(amountLimit)
    const parsedThreshold = Number(threshold)

    if (!Number.isFinite(parsedLimit) || parsedLimit <= 0) {
      setError('Enter a limit greater than 0')
      return
    }
    if (!Number.isFinite(parsedThreshold) || parsedThreshold < 1 || parsedThreshold > 100) {
      setError('Alert threshold must be between 1 and 100')
      return
    }

    setError(null)
    updateBudget.mutate(
      { id, amount_limit: parsedLimit, alert_threshold_pct: parsedThreshold },
      { onSuccess: () => setOpen(false) },
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          setAmountLimit(String(limit))
          setThreshold(String(alertThresholdPct))
          setError(null)
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={`Edit ${categoryName} budget`}
        description="Update the monthly cap or when you want to be alerted."
      >
        <form onSubmit={submit} className="space-y-4">
          <div>
            <Label htmlFor={`limit-${id}`}>Monthly limit</Label>
            <Input
              id={`limit-${id}`}
              type="number"
              step="0.01"
              min="0"
              value={amountLimit}
              onChange={(e) => setAmountLimit(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor={`threshold-${id}`}>Alert me at (%)</Label>
            <Input
              id={`threshold-${id}`}
              type="number"
              min="1"
              max="100"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
            />
          </div>
          {error && <p className="text-xs text-[var(--color-negative-600)]">{error}</p>}
          <Button type="submit" className="w-full" disabled={updateBudget.isPending}>
            {updateBudget.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}