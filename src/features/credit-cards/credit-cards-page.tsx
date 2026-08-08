import { useEffect, useState } from 'react'
import { CreditCard, AlertTriangle, Check, RotateCcw } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/skeleton'
import { ProgressRing } from '@/components/ui/progress-ring'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useCreditCardSummaries, useCardStatementHistory, useSetCardStatementPaid } from '@/features/credit-cards/hooks'
import { useTransactions } from '@/features/transactions/hooks'
import { TransactionRow } from '@/features/transactions/transaction-row'
import type { CardStatement } from '@/lib/supabase/types'

/** Formats a "yyyy-mm-dd" date for dropdown labels (e.g. "Jun 15 – Jul 14"). */
function formatCycleRange(statement: CardStatement): string {
  const start = statement.cycle_start_date ?? statement.statement_month
  const end = statement.cycle_end_date ?? statement.statement_month
  const startLabel = new Date(`${start}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  const endLabel = new Date(`${end}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  return `${startLabel} – ${endLabel}`
}

/** Inclusive ISO date range for a statement, or null if no dates are available.
 *  When cycle dates are missing (older imports), falls back to the calendar
 *  month of the statement (1st through last day). */
function statementDateRange(statement: CardStatement): { start: string; end: string } | null {
  const start = statement.cycle_start_date ?? statement.statement_month
  if (!start) return null

  if (statement.cycle_end_date) {
    return { start, end: statement.cycle_end_date }
  }

  // Last day of the statement month — read from local calendar fields, NOT
  // toISOString(), which would shift the date back a day for any timezone
  // ahead of UTC (IST is UTC+5:30).
  const [year, month] = statement.statement_month.split('-').map(Number)
  const lastDay = new Date(year, month, 0).getDate()
  return { start, end: `${statement.statement_month.slice(0, 7)}-${String(lastDay).padStart(2, '0')}` }
}

function daysUntil(dateStr: string): number {
  const due = new Date(dateStr)
  const today = new Date()
  due.setHours(0, 0, 0, 0)
  today.setHours(0, 0, 0, 0)
  return Math.round((due.getTime() - today.getTime()) / 86_400_000)
}

export function CreditCardsPage() {
  const { data: summaries, isLoading } = useCreditCardSummaries()
  const setCardStatementPaid = useSetCardStatementPaid()
  const [selectedCardId, setSelectedCardId] = useState<string>('')
  const [selectedStatementId, setSelectedStatementId] = useState<string>('')

  useEffect(() => {
    if (!selectedCardId && summaries && summaries.length > 0) {
      setSelectedCardId(summaries[0].account.id)
    }
  }, [summaries, selectedCardId])

  const selected = summaries?.find((s) => s.account.id === selectedCardId) ?? null
  const { data: history } = useCardStatementHistory(selectedCardId)

  // Default to the newest statement for the selected card.
  useEffect(() => {
    if (history && history.length > 0) {
      setSelectedStatementId((prev) => (prev && history.some((s) => s.id === prev) ? prev : history[0].id))
    } else {
      setSelectedStatementId('')
    }
  }, [history])

  const selectedStatement = history?.find((s) => s.id === selectedStatementId) ?? null
  const cycleRange = selectedStatement ? statementDateRange(selectedStatement) : null

  const { data: transactions, isLoading: transactionsLoading } = useTransactions({
    accountIds: selectedCardId ? [selectedCardId] : undefined,
    dateFrom: cycleRange?.start,
    dateTo: cycleRange?.end,
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
          {summaries.map(({ account, latestStatement, pendingBalance, effectiveUtilizationPct }) => {
            const isSelected = account.id === selectedCardId
            const isHighUtilization = (effectiveUtilizationPct ?? 0) > 30
            const dueSoon = latestStatement && !latestStatement.is_paid ? daysUntil(latestStatement.due_date) : null

            return (
              <div
                key={account.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedCardId(account.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    setSelectedCardId(account.id)
                  }
                }}
                className="text-left cursor-pointer"
              >
                <Card className={cn('transition-colors', isSelected && 'ring-2 ring-[var(--color-brand-500)]')}>
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-4">
                      <ProgressRing
                        value={effectiveUtilizationPct ?? 0}
                        size={64}
                        strokeWidth={6}
                        color={
                          isHighUtilization ? 'var(--color-negative-500)' : 'var(--color-brand-500)'
                        }
                      >
                        <span className="text-xs font-semibold num">{effectiveUtilizationPct ?? '–'}%</span>
                      </ProgressRing>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{account.name}</p>
                        <p className="font-display text-lg font-semibold num">
                          {formatCurrency(pendingBalance, account.currency)}
                        </p>
                        <p className="text-xs text-muted">
                          pending across unpaid statements
                          {account.credit_limit ? ` of ${formatCurrency(account.credit_limit)} limit` : ''}
                        </p>
                      </div>
                    </div>

                    <div className="mt-3 pt-3 border-t border-hairline flex items-center justify-between gap-2">
                      {latestStatement ? (
                        <p className="text-xs text-muted">
                          {formatCurrency(latestStatement.statement_amount)} due{' '}
                          {new Date(latestStatement.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      ) : (
                        <p className="text-xs text-muted">No statement imported yet</p>
                      )}
                      <div className="flex items-center gap-1.5 shrink-0">
                        {latestStatement?.is_paid && <Badge variant="positive">Paid</Badge>}
                        {dueSoon !== null && dueSoon <= 7 && (
                          <Badge variant={dueSoon < 0 ? 'negative' : 'warning'}>
                            <AlertTriangle className="h-3 w-3" />
                            {dueSoon < 0 ? 'Overdue' : `Due in ${dueSoon}d`}
                          </Badge>
                        )}
                        {latestStatement && (
                          <Button
                            size="sm"
                            variant={latestStatement.is_paid ? 'secondary' : 'default'}
                            onClick={(e) => {
                              e.stopPropagation()
                              setCardStatementPaid.mutate({ id: latestStatement.id, isPaid: !latestStatement.is_paid })
                            }}
                            disabled={setCardStatementPaid.isPending}
                          >
                            {latestStatement.is_paid ? (
                              <>
                                <RotateCcw className="h-3 w-3" />
                                Mark unpaid
                              </>
                            ) : (
                              <>
                                <Check className="h-3 w-3" />
                                Mark paid
                              </>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )
          })}
        </div>
      )}

      {selected && history && history.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle>{selected.account.name} — statement history</CardTitle>
              <div className="text-sm text-muted">
                Total pending: <span className="font-medium">{formatCurrency(selected.pendingBalance, selected.account.currency)}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {/* Mobile card layout */}
            <div className="space-y-3 sm:hidden">
              {history.map((s) => (
                <div key={s.id} className="border border-hairline rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">
                        {new Date(s.statement_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </p>
                      <p className="text-xs text-muted">{formatCycleRange(s)}</p>
                    </div>
                    <Badge variant={s.is_paid ? 'positive' : 'warning'}>{s.is_paid ? 'Paid' : 'Unpaid'}</Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-xs text-muted">Amount</p>
                      <p className="font-medium num">{formatCurrency(s.statement_amount)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted">Due date</p>
                      <p className="font-medium">
                        {new Date(s.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2 border-t border-hairline">
                    <div className="text-xs text-muted">
                      {s.reward_points_earned ? `+${s.reward_points_earned} pts` : '–'}
                    </div>
                    <Button
                      size="sm"
                      variant={s.is_paid ? 'secondary' : 'default'}
                      onClick={() => setCardStatementPaid.mutate({ id: s.id, isPaid: !s.is_paid })}
                      disabled={setCardStatementPaid.isPending}
                    >
                      {s.is_paid ? (
                        <>
                          <RotateCcw className="h-3 w-3" />
                          Unpaid
                        </>
                      ) : (
                        <>
                          <Check className="h-3 w-3" />
                          Mark paid
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop table layout */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-muted">
                  <tr className="border-b border-hairline">
                    <th className="text-left font-medium py-2">Statement</th>
                    <th className="text-left font-medium py-2">Cycle</th>
                    <th className="text-right font-medium py-2">Amount</th>
                    <th className="text-right font-medium py-2">Min due</th>
                    <th className="text-center font-medium py-2">Due date</th>
                    <th className="text-center font-medium py-2">Status</th>
                    <th className="text-right font-medium py-2">Points</th>
                    <th className="text-center font-medium py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((s) => (
                    <tr key={s.id} className="border-b border-hairline last:border-0">
                      <td className="py-2 font-medium">
                        {new Date(s.statement_month).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}
                      </td>
                      <td className="py-2 text-left text-muted">{formatCycleRange(s)}</td>
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
                      <td className="py-2 text-center">
                        <Button
                          size="sm"
                          variant={s.is_paid ? 'secondary' : 'default'}
                          onClick={() => setCardStatementPaid.mutate({ id: s.id, isPaid: !s.is_paid })}
                          disabled={setCardStatementPaid.isPending}
                        >
                          {s.is_paid ? (
                            <>
                              <RotateCcw className="h-3 w-3" />
                              Unpaid
                            </>
                          ) : (
                            <>
                              <Check className="h-3 w-3" />
                              Mark paid
                            </>
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {selectedCardId && (
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <CardTitle>Transactions</CardTitle>
              {history && history.length > 0 && (
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-xs text-muted shrink-0">Statement cycle</span>
                  <Select
                    value={selectedStatementId}
                    onChange={(e) => setSelectedStatementId(e.target.value)}
                    className="flex-1 sm:w-56"
                  >
                    {history.map((s) => (
                      <option key={s.id} value={s.id}>
                        {formatCycleRange(s)}
                      </option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            {selectedStatement && (
              <>
                <div className="flex items-center gap-3 flex-wrap mt-1 text-sm hidden sm:flex">
                  <span className="text-muted">
                    Cycle:{' '}
                    <span className="font-medium text-inherit">
                      {formatCycleRange(selectedStatement)}
                    </span>
                  </span>
                  <span className="text-muted">
                    Amount due:{' '}
                    <span className="font-medium text-inherit">
                      {formatCurrency(selectedStatement.statement_amount)}
                    </span>
                  </span>
                  <span className="text-muted">
                    Due date:{' '}
                    <span className="font-medium text-inherit">
                      {new Date(`${selectedStatement.due_date}T00:00:00`).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                      })}
                    </span>
                  </span>
                  {selectedStatement.is_paid && <Badge variant="positive">Paid</Badge>}
                </div>
                <div className="flex items-center gap-2 mt-1 text-sm sm:hidden">
                  <span className="text-muted">
                    {formatCurrency(selectedStatement.statement_amount)}
                  </span>
                  <span className="text-muted">•</span>
                  <span className="text-muted">
                    {new Date(`${selectedStatement.due_date}T00:00:00`).toLocaleDateString('en-IN', {
                      day: 'numeric',
                      month: 'short',
                    })}
                  </span>
                  {selectedStatement.is_paid && <Badge variant="positive" className="ml-auto">Paid</Badge>}
                </div>
              </>
            )}
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
