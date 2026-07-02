import { Plus, Landmark, ArrowDownLeft, ArrowUpRight, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useDebts, useDeleteDebt } from '@/features/debts/hooks'
import { DebtFormDialog } from '@/features/debts/debt-form-dialog'
import { RepaymentDialog } from '@/features/debts/repayment-dialog'

export function DebtsPage() {
  const { data: debts, isLoading, isError } = useDebts()
  const deleteDebt = useDeleteDebt()

  const lent = debts?.filter((d) => d.direction === 'lent') ?? []
  const borrowed = debts?.filter((d) => d.direction === 'borrowed') ?? []
  const totalLent = lent.reduce((sum, d) => sum + d.outstanding_amount, 0)
  const totalBorrowed = borrowed.reduce((sum, d) => sum + d.outstanding_amount, 0)

  return (
    <div className="max-w-[1000px] space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-semibold">Debts</h1>
        <DebtFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add debt
            </Button>
          }
        />
      </div>

      {debts && debts.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-positive-500)]/15 flex items-center justify-center">
                <ArrowDownLeft className="h-4 w-4 text-[var(--color-positive-600)]" />
              </div>
              <div>
                <p className="text-xs text-muted">You're owed</p>
                <p className="font-display text-xl font-semibold num">{formatCurrency(totalLent)}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[var(--color-negative-500)]/15 flex items-center justify-center">
                <ArrowUpRight className="h-4 w-4 text-[var(--color-negative-600)]" />
              </div>
              <div>
                <p className="text-xs text-muted">You owe</p>
                <p className="font-display text-xl font-semibold num">{formatCurrency(totalBorrowed)}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <EmptyState icon={Landmark} title="Couldn't load debts" description="Check your Supabase connection and refresh." />
        </Card>
      )}

      {!isLoading && !isError && debts?.length === 0 && (
        <Card>
          <EmptyState icon={Landmark} title="No debts tracked" description="Track money you've lent or borrowed and keep tabs on repayments." />
        </Card>
      )}

      {!isLoading && debts && debts.length > 0 && (
        <Card>
          <CardContent className="pt-4 divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
            {debts.map((debt) => (
              <div key={debt.id} className="group flex items-center gap-3 py-3">
                <div
                  className={cn(
                    'h-9 w-9 rounded-lg flex items-center justify-center shrink-0',
                    debt.direction === 'lent' ? 'bg-[var(--color-positive-500)]/15' : 'bg-[var(--color-negative-500)]/15',
                  )}
                >
                  {debt.direction === 'lent' ? (
                    <ArrowDownLeft className="h-4 w-4 text-[var(--color-positive-600)]" />
                  ) : (
                    <ArrowUpRight className="h-4 w-4 text-[var(--color-negative-600)]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{debt.counterparty_name}</p>
                  <p className="text-xs text-muted">
                    {debt.direction === 'lent' ? 'Owes you' : 'You owe'}
                    {debt.due_date && ` · Due ${new Date(debt.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                  </p>
                </div>
                <p className="text-sm font-medium num shrink-0">{formatCurrency(debt.outstanding_amount)}</p>
                <RepaymentDialog
                  debt={debt}
                  trigger={
                    <Button size="sm" variant="secondary">
                      Repay
                    </Button>
                  }
                />
                <button
                  onClick={() => deleteDebt.mutate(debt.id)}
                  className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-all shrink-0"
                  aria-label={`Delete ${debt.counterparty_name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
