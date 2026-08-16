import { useMemo, useState } from 'react'
import { Plus, ArrowLeftRight, Search, ChevronLeft, ChevronRight, SlidersHorizontal, X, TrendingDown, TrendingUp, WalletCards } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { MultiSelect } from '@/components/ui/multi-select'
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
  const [accountIds, setAccountIds] = useState<string[]>([])
  const [type, setType] = useState<Transaction['type'] | ''>('')
  const [datePreset, setDatePreset] = useState<DateRangePreset>('all')
  const [cycleReference, setCycleReference] = useState(() => new Date())
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

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
    accountIds: accountIds.length > 0 ? accountIds : undefined,
    type: type || undefined,
    dateFrom,
    dateTo,
  })

  // "Previous month final balance": the closing balance as of the start of the
  // selected date range (last day of previous month for both this-month and cycle).
  const { data: previousMonthBalance } = useBalanceAsOf(
    accountIds,
    (datePreset === 'cycle' || datePreset === 'this-month') ? statementCycle.start : undefined,
  )

  const summary = useMemo(() => {
    const income = transactions?.reduce((total, txn) => total + (txn.type === 'income' ? txn.amount : 0), 0) ?? 0
    const expenses = transactions?.reduce((total, txn) => total + (txn.type === 'expense' ? txn.amount : 0), 0) ?? 0
    return { income, expenses, net: income - expenses, count: transactions?.length ?? 0 }
  }, [transactions])

  const hasActiveFilters = Boolean(search || accountIds.length > 0 || type || datePreset !== 'all')

  return (
    <div className="min-w-0 max-w-[1100px] space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted">Your activity</p>
          <h1 className="font-display text-2xl font-semibold">Transactions</h1>
          <p className="mt-1 text-sm text-muted">Review and manage your money in one place.</p>
        </div>
        <TransactionFormDialog
          trigger={
            <Button size="sm" className="hidden sm:inline-flex">
              <Plus className="h-4 w-4" />
              Add transaction
            </Button>
          }
        />
      </div>

      <div className="grid w-full max-w-full min-w-0 grid-cols-2 gap-3 lg:grid-cols-4 max-sm:max-w-full">
        <SummaryCard icon={WalletCards} label="Visible transactions" value={summary.count.toLocaleString()} />
        <SummaryCard icon={TrendingUp} label="Income" value={formatCurrency(summary.income)} tone="positive" />
        <SummaryCard icon={TrendingDown} label="Expenses" value={formatCurrency(summary.expenses)} tone="negative" />
        <SummaryCard icon={ArrowLeftRight} label="Net activity" value={formatCurrency(summary.net)} tone={summary.net >= 0 ? 'positive' : 'negative'} />
      </div>

      <section className="min-w-0 max-w-full space-y-3" aria-label="Transaction filters">
        <div className="flex min-w-0 max-w-full flex-wrap gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search notes…"
              className="pl-9"
              aria-label="Search transactions"
            />
          </div>
          <Button variant="outline" size="sm" className="sm:hidden" onClick={() => setFiltersOpen((open) => !open)}>
            <SlidersHorizontal className="h-4 w-4" />
            Filters{hasActiveFilters ? ' ·' : ''}
          </Button>
        </div>
        <div className={`${filtersOpen ? 'grid' : 'hidden'} min-w-0 max-w-full grid-cols-1 gap-2 sm:flex sm:flex-wrap`}>
          <Select value={type} onChange={(e) => setType(e.target.value as typeof type)} className="sm:w-40">
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expense</option>
            <option value="transfer">Transfer</option>
          </Select>
          <MultiSelect
            options={accounts?.map((a) => ({ value: a.id, label: a.name })) ?? []}
            selected={accountIds}
            onChange={setAccountIds}
            placeholder="All accounts"
            className="sm:w-56"
          />
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
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('')
                setAccountIds([])
                setType('')
                setDatePreset('all')
                setCustomFrom('')
                setCustomTo('')
              }}
            >
              <X className="h-4 w-4" />
              Clear filters
            </Button>
          )}
        </div>
      </section>

      {(datePreset === 'this-month' || datePreset === 'cycle') && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <button
            type="button"
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
            type="button"
            onClick={() => setCycleReference((d) => shiftMonth(d, 1))}
            className="rounded-lg p-1.5 hover:surface-2 text-muted"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          {(datePreset === 'cycle' || datePreset === 'this-month') && previousMonthBalance !== undefined && (
            <span className="ml-0 text-muted sm:ml-2">
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

      <Card className="overflow-hidden">
        <CardContent className="w-full min-w-0 max-w-full pt-4">
          {!isLoading && !isError && transactions && transactions.length > 0 && (
            <div className="mb-3 flex items-center justify-between border-b border-[var(--color-border-light)] pb-3 text-xs text-muted dark:border-[var(--color-border-dark)]">
              <span className="hidden sm:inline">Hover a row for quick actions</span>
            </div>
          )}
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
            <div className="w-full">
              <EmptyState
                icon={ArrowLeftRight}
                title="No transactions found"
                description={
                  search || accountIds.length > 0 || type || datePreset !== 'all'
                    ? 'Try adjusting your filters.'
                    : 'Add your first transaction to start building your history.'
                }
              />
            </div>
          )}

          {!isLoading && transactions && transactions.length > 0 && (
            <div className="w-full divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {transactions.flatMap((txn) => {
                // A transfer has no single sign that's correct for both sides
                // at once. When viewing "All accounts" (no filter) or when both
                // sides of the transfer are among the selected accounts, show
                // it as two entries — one leaving the source account
                // (negative), one arriving at the destination (positive) —
                // same underlying transaction, editing/deleting either one
                // acts on it as a whole.
                if (txn.type === 'transfer' && txn.transfer_account_id) {
                  const sourceSelected = accountIds.length === 0 || accountIds.includes(txn.account_id)
                  const destSelected = accountIds.length === 0 || accountIds.includes(txn.transfer_account_id)
                  if (sourceSelected && destSelected) {
                    return [
                      <TransactionRow key={`${txn.id}-out`} txn={txn} viewAccountId={txn.account_id} />,
                      <TransactionRow key={`${txn.id}-in`} txn={txn} viewAccountId={txn.transfer_account_id} />,
                    ]
                  }
                  if (sourceSelected) {
                    return [<TransactionRow key={txn.id} txn={txn} viewAccountId={txn.account_id} />]
                  }
                  if (destSelected) {
                    return [<TransactionRow key={txn.id} txn={txn} viewAccountId={txn.transfer_account_id} />]
                  }
                }
                return [<TransactionRow key={txn.id} txn={txn} />]
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TransactionFormDialog
        trigger={
          <Button size="lg" className="fixed bottom-20 right-4 z-10 rounded-full px-4 shadow-lg sm:hidden">
            <Plus className="h-5 w-5" />
            <span className="sr-only">Add transaction</span>
          </Button>
        }
      />
    </div>
  )
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone = 'default',
}: {
  icon: typeof WalletCards
  label: string
  value: string
  tone?: 'default' | 'positive' | 'negative'
}) {
  const toneClass = tone === 'positive'
    ? 'text-[var(--color-positive-600)]'
    : tone === 'negative'
      ? 'text-[var(--color-negative-600)]'
      : 'text-inherit'

  return (
    <Card className="min-w-0 max-w-full p-4 sm:p-5">
      <div className="mb-3 flex items-center gap-2 text-muted">
        <Icon className="h-4 w-4" />
        <span className="truncate text-xs font-medium">{label}</span>
      </div>
      <p className={`num text-lg font-semibold ${toneClass}`}>{value}</p>
    </Card>
  )
}
