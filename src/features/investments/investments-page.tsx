import { Plus, LineChart, Trash2, TrendingUp, TrendingDown } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useHoldings, useDeleteHolding, INVESTMENT_TYPE_META } from '@/features/investments/hooks'
import { HoldingFormDialog } from '@/features/investments/holding-form-dialog'

export function InvestmentsPage() {
  const { data: holdings, isLoading, isError } = useHoldings()
  const deleteHolding = useDeleteHolding()

  const totalInvested = holdings?.reduce((sum, h) => sum + h.invested_amount, 0) ?? 0
  const totalCurrent = holdings?.reduce((sum, h) => sum + h.current_value, 0) ?? 0
  const totalGain = totalCurrent - totalInvested
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0

  return (
    <div className="max-w-[1000px] space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-semibold">Investments</h1>
        <HoldingFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add holding
            </Button>
          }
        />
      </div>

      {holdings && holdings.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Current value</p>
              <p className="font-display text-2xl font-semibold mt-2 num">{formatCurrency(totalCurrent)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Invested</p>
              <p className="font-display text-2xl font-semibold mt-2 num">{formatCurrency(totalInvested)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5">
              <p className="text-xs font-medium uppercase tracking-wider text-muted">Total gain/loss</p>
              <div className="flex items-center gap-1.5 mt-2">
                {totalGain >= 0 ? (
                  <TrendingUp className="h-4 w-4 text-[var(--color-positive-600)]" />
                ) : (
                  <TrendingDown className="h-4 w-4 text-[var(--color-negative-600)]" />
                )}
                <p
                  className={cn(
                    'font-display text-2xl font-semibold num',
                    totalGain >= 0 ? 'text-[var(--color-positive-600)]' : 'text-[var(--color-negative-600)]',
                  )}
                >
                  {formatCurrency(Math.abs(totalGain))} ({gainPct.toFixed(1)}%)
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Holdings</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          )}
          {isError && (
            <EmptyState icon={LineChart} title="Couldn't load holdings" description="Check your Supabase connection and refresh." />
          )}
          {!isLoading && !isError && holdings?.length === 0 && (
            <EmptyState icon={LineChart} title="No holdings yet" description="Add mutual funds, stocks, crypto, gold, or EPF/PPF to track your portfolio." />
          )}
          {!isLoading && holdings && holdings.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {holdings.map((h) => {
                const meta = INVESTMENT_TYPE_META[h.type]
                const Icon = meta.icon
                const gain = h.current_value - h.invested_amount
                const gainPctRow = h.invested_amount > 0 ? (gain / h.invested_amount) * 100 : 0
                return (
                  <div key={h.id} className="group flex items-center gap-3 py-2.5">
                    <div className="h-8 w-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1f` }}>
                      <Icon className="h-4 w-4" style={{ color: meta.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{h.name}</p>
                      <p className="text-xs text-muted">{meta.label}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-medium num">{formatCurrency(h.current_value)}</p>
                      <p className={cn('text-xs num', gain >= 0 ? 'text-[var(--color-positive-600)]' : 'text-[var(--color-negative-600)]')}>
                        {gain >= 0 ? '+' : ''}
                        {gainPctRow.toFixed(1)}%
                      </p>
                    </div>
                    <button
                      onClick={() => deleteHolding.mutate(h.id)}
                      className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-all shrink-0"
                      aria-label={`Delete ${h.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
