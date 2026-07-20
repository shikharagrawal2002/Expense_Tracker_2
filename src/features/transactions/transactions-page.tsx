import { useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, Search, ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { useTransactions, useBalanceAsOf } from '@/features/transactions/hooks'
import { useAccounts } from '@/features/accounts/hooks'
import { TransactionRow } from '@/features/transactions/transaction-row'
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog'
import { getCalendarMonthRange, getStatementCycleRange, shiftMonth, type DateRangePreset } from '@/features/transactions/date-range'
import type { Transaction } from '@/lib/supabase/types'

export function TransactionsPage() {
  const [search, setSearch] = useState('')
  const [accountId, setAccountId] = useState('')
  const [type, setType] = useState<Transaction['type'] | ''>('')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all')
  const [cycleReference, setCycleReference] = useState(() => new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const { data: accounts } = useAccounts()

  const calendarMonth = useMemo(() => getCalendarMonthRange(cycleReference), [cycleReference])
  const statementCycle = useMemo(() => getStatementCycleRange(cycleReference), [cycleReference])

  const { dateFrom, dateTo } = useMemo(() => {
    if (datePreset === 'this-month') return { dateFrom: calendarMonth.start, dateTo: calendarMonth.end }
    if (datePreset === 'cycle') return { dateFrom: statementCycle.start, dateTo: statementCycle.end }
    if (datePreset === 'custom') return { dateFrom: customFrom || undefined, dateTo: customTo || undefined }
    return { dateFrom: undefined, dateTo: undefined }
  }, [datePreset, calendarMonth, statementCycle, customFrom, customTo])

  const {
    data: transactions,
    isLoading,
    isError,
  } = useTransactions({
    search: search || undefined,
    accountId: accountId || undefined,
    type: type || undefined,
    dateFrom,
    dateTo,
  })

  // "Previous month final balance": the closing balance as of the start of the
  // statement cycle (which is, by definition, the last day of the previous month).
  const { data: previousMonthBalance } = useBalanceAsOf(
    accountId || undefined,
    datePreset === 'cycle' ? statementCycle.start : undefined,
  )

  return (
    <div className="max-w-[1000px] space-y-5">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-semibold">Transactions</h1>
        <TransactionFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          }
        />
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search notes…"
            className="w-full h-10 rounded-lg surface-2 border border-hairline pl-9 pr-3 text-sm placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-[var(--color-brand-500)]"
          />
        </div>
        <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="sm:w-40">
          <option value="">All types</option>
          <option value="income">Income</option>
          <option value="expense">Expense</option>
          <option value="transfer">Transfer</option>
        </Select>
        <Select value={accountId} onChange={(e) => setAccountId(e.target.value)} className="sm:w-48">
          <option value="">All accounts</option>
          {accounts?.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </Select>
        <Select
          value={datePreset}
          onChange={(e) => setDatePreset(e.target.value as DateRangePreset)}
          className="sm:w-44"
        >
          <option value="all">All time</option>
          <option value="this-month">This month</option>
          <option value="cycle">Monthly (statement cycle)</option>
          <option value="custom">Custom range</option>
        </Select>
      </div>

      {(datePreset === 'this-month' || datePreset === 'cycle') && (
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setCycleReference((d) => shiftMonth(d, -1))}
            className="rounded-lg p-1.5 hover:surface-2 text-muted"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="font-medium min-w-[180px] text-center">
            {datePreset === 'cycle' ? statementCycle.label : calendarMonth.label}
          </span>
          <button
            onClick={() => setCycleReference((d) => shiftMonth(d, 1))}
            className="rounded-lg p-1.5 hover:surface-2 text-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {datePreset === 'cycle' && previousMonthBalance !== undefined && (
            <span className="ml-2 text-muted">
              Previous month final balance:{' '}
              <span className="font-medium text-inherit">{formatCurrency(previousMonthBalance)}</span>
            </span>
          )}
        </div>
      )}

      {datePreset === 'custom' && (
        <div className="flex flex-wrap items-center gap-2">
          <Input type="date" value={customFrom} onChange={(e) => setCustomFrom(e.target.value)} className="sm:w-44" />
          <span className="text-sm text-muted">to</span>
          <Input type="date" value={customTo} onChange={(e) => setCustomTo(e.target.value)} className="sm:w-44" />
        </div>
      )}

      <Card>
        <CardContent className="pt-4">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          )}

          {isError && (
            <EmptyState
              icon={ArrowLeftRight}
              title="Couldn't load transactions"
              description="Check your Supabase connection in .env.local, then refresh."
            />
          )}

          {!isLoading && !isError && transactions?.length === 0 && (
            <EmptyState
              icon={ArrowLeftRight}
              title="No transactions found"
              description={
                search || accountId || type || datePreset !== 'all'
                  ? 'Try adjusting your filters.'
                  : 'Add your first transaction to start building your history.'
              }
            />
          )}

          {!isLoading && transactions && transactions.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {transactions.map((txn) => (
                <TransactionRow key={txn.id} txn={txn} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
