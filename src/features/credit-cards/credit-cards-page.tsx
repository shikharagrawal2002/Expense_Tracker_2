import { useEffect, useState } from 'react'
import { CreditCard, AlertTriangle } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useCreditCardSummaries, useCardStatementHistory } from '@/features/credit-cards/hooks'
import { useTransactions } from '@/features/transactions/hooks'
import { TransactionRow } from '@/features/transactions/transaction-row'

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

export function CreditCardsPage() {
  const { data: summaries, isLoading } = useCreditCardSummaries()
  const [selectedCardId, setSelectedCardId] = useState<string>('')

  useEffect(() => {
    if (!selectedCardId && summaries && summaries.length > 0) {
      setSelectedCardId(summaries[0].account.id)
    }
  }, [summaries, selectedCardId])

  const selected = summaries?.find((s) => s.account.id === selectedCardId)
  const { data: history } = useCardStatementHistory(selectedCardId)
  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    accountId: selectedCardId || undefined,
  })

  return (
    <div className="max-w-[1000px] space-y-5">
      <div>
        <h1 className="font-display text-2xl font-semibold">Credit cards</h1>
        <p className="text-sm text-muted">Balances, statement due dates, and transactions for each card.</p>
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {!isLoading && summaries?.length === 0 && (
        <EmptyState
          icon={CreditCard}
          title="No credit cards yet"
          description="Add a credit card account under Accounts, then import its statement here to start tracking it."
        />
      )}

      {!isLoading && summaries && summaries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {summaries.map(({ account, latestStatement, utilizationPct }) => {
            const isSelected = account.id === selectedCardId
            const isHighUtilization = (utilizationPct ?? 0) > 30
            const dueSoon = latestStatement && !latestStatement.is_paid ? daysUntil(latestStatement.due_date) : null

            return (
              <button key={account.id} onClick={() => setSelectedCardId(account.id)} className="text-left">
                <Card className={cn('transition-colors cursor-pointer', isSelected && 'ring-2 ring-[var(--color-brand-500)]')}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <ProgressRing
                        value={utilizationPct ?? 0}
                        size={64}
                        strokeWidth={6}
                        color={
                          isHighUtilization ? 'var(--color-negative-500)' : 'var(--color-brand-500)'
                        }
                      >
                        <span className="text-xs font-semibold num">{utilizationPct ?? '–'}%</span>
                      </ProgressRing>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{account.name}</p>
                        <p className="font-display text-lg font-semibold num">
                          {formatCurrency(Math.abs(account.current_balance), account.currency)}
                        </p>
                        <p className="text-xs text-muted">owed{account.credit_limit ? ` of ${formatCurrency(account.credit_limit)} limit` : ''}</p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between">
                      {latestStatement ? (
                        <p className="text-xs text-muted">
                          {formatCurrency(latestStatement.statement_amount)} due{' '}
                          {new Date(latestStatement.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted">No statement imported yet</p>
                      )}
                      {latestStatement?.is_paid && <Badge variant="positive">Paid</Badge>}
                      {dueSoon !== null && dueSoon <= 7 && (
                        <Badge variant={dueSoon < 0 ? 'negative' : 'warning'}>
                          <AlertTriangle className="h-3 w-3" />
                          {dueSoon < 0 ? 'Overdue' : `Due in ${dueSoon}d`}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </button>
            )
          })}
        </div>
      )}

      {selected && history && history.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>{selected.account.name} — statement history</CardTitle>
          </CardHeader>
          <CardContent className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr className="border-b border-hairline">
                  <th className="text-left font-medium py-2">Statement</th>
                  <th className="text-right font-medium py-2">Amount</th>
                  <th className="text-right font-medium py-2">Min due</th>
                  <th className="text-center font-medium py-2">Due date</th>
                  <th className="text-center font-medium py-2">Status</th>
                  <th className="text-right font-medium py-2">Points</th>
                </tr>
              </thead>
              <tbody>
                {history.map((s) => (
                  <tr key={s.id} className="border-b border-hairline last:border-0">
                    <td className="py-2 font-medium">
                      {new Date(s.statement_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                    </td>
                    <td className="py-2 text-right num">{formatCurrency(s.statement_amount)}</td>
                    <td className="py-2 text-right num text-muted">
                      {s.minimum_due != null ? formatCurrency(s.minimum_due) : '–'}
                    </td>
                    <td className="py-2 text-center">
                      {new Date(s.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </td>
                    <td className="py-2 text-center">
                      <Badge variant={s.is_paid ? 'positive' : 'warning'}>{s.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                    </td>
                    <td className="py-2 text-right num text-[var(--color-warning-500)]">
                      {s.reward_points_earned ? `+${s.reward_points_earned}` : '–'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      {selectedCardId && (
        <Card>
          <CardHeader>
            <CardTitle>Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {transactionsLoading && (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            )}

            {!transactionsLoading && transactions?.length === 0 && (
              <EmptyState
                icon={CreditCard}
                title="No transactions on this card"
                description="Import a statement or add a transaction manually to see it here."
              />
            )}

            {!transactionsLoading && transactions && transactions.length > 0 && (
              <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
                {transactions.map((txn) => (
                  <TransactionRow
                    key={txn.id}
                    txn={txn}
                    viewAccountId={selectedCardId}
                    splitButtonTypes={['income', 'expense']}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
