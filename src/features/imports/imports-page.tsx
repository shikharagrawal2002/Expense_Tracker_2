import { useMemo, useState } from 'react'
import { Landmark, CreditCard, AlertTriangle } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label } from '@/components/ui/input'
import { useAccounts } from '@/features/accounts/hooks'
import { useCategories } from '@/features/categories/hooks'
import { StatementDropzone } from '@/features/imports/statement-dropzone'
import { ParsedTransactionsTable } from '@/features/imports/parsed-transactions-table'
import { CardSummaryForm } from '@/features/imports/card-summary-form'
import { ImportHistoryList } from '@/features/imports/import-history-list'
import { useParseStatement, useConfirmBankImport, useConfirmCardImport } from '@/features/imports/hooks'
import { toReviewRow, type ImportKind, type ReviewRow } from '@/features/imports/types'
import type { CardStatementSummary, NewTransaction } from '@/lib/supabase/types'

const TABS: Array<{ key: ImportKind; label: string; icon: typeof Landmark; hint: string }> = [
  {
    key: 'bank',
    label: 'Bank statement',
    icon: Landmark,
    hint: 'Upload a bank account statement (CSV, Excel, or PDF) to auto-populate transactions.',
  },
  {
    key: 'card',
    label: 'Credit card statement',
    icon: CreditCard,
    hint: 'Upload a credit card statement to pull the due date, total amount due, and transaction list.',
  },
]

export function ImportsPage() {
  const [kind, setKind] = useState<ImportKind>('bank')
  const [accountId, setAccountId] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [cardSummary, setCardSummary] = useState<CardStatementSummary | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const parseStatement = useParseStatement()
  const confirmBank = useConfirmBankImport()
  const confirmCard = useConfirmCardImport()

  const relevantAccounts = useMemo(
    () => (accounts ?? []).filter((a) => (kind === 'card' ? a.type === 'credit_card' : a.type !== 'credit_card')),
    [accounts, kind],
  )

  const account = accounts?.find((a) => a.id === accountId)

  function resetResults() {
    setRows([])
    setCardSummary(null)
    setWarnings([])
    setStatusMessage(null)
  }

  function handleTabChange(nextKind: ImportKind) {
    setKind(nextKind)
    setAccountId('')
    setFile(null)
    resetResults()
  }

  async function handleParse() {
    if (!file || !accountId) return
    resetResults()
    const result = await parseStatement.mutateAsync({ file, kind, accountId })
    setRows(result.transactions.map((t, i) => toReviewRow(t, i, null)))
    if (result.cardSummary) setCardSummary(result.cardSummary)
    setWarnings(result.warnings)
  }

  function toReviewRowsAsTransactions(): NewTransaction[] {
    return rows
      .filter((r) => r.include)
      .map((r) => ({
        account_id: accountId,
        type: r.direction === 'credit' ? 'income' : 'expense',
        amount: r.amount,
        occurred_at: r.date,
        category_id: r.categoryId || undefined,
        notes: r.description,
        currency: account?.currency,
      }))
  }

  async function handleConfirm() {
    if (!file || !accountId) return
    const transactions = toReviewRowsAsTransactions()
    const duplicateCount = rows.filter((r) => r.isDuplicate).length

    if (kind === 'bank') {
      const res = await confirmBank.mutateAsync({
        accountId,
        fileName: file.name,
        rowCount: rows.length,
        duplicateCount,
        transactions,
      })
      setStatusMessage(`Imported ${res.imported} transaction${res.imported === 1 ? '' : 's'}.`)
    } else {
      if (!cardSummary || !cardSummary.dueDate || cardSummary.statementAmount === null) return
      const res = await confirmCard.mutateAsync({
        accountId,
        fileName: file.name,
        rowCount: rows.length,
        duplicateCount,
        cardStatement: {
          account_id: accountId,
          statement_month: cardSummary.statementMonth,
          statement_amount: cardSummary.statementAmount,
          due_date: cardSummary.dueDate,
          minimum_due: cardSummary.minimumDue ?? undefined,
        },
        transactions,
      })
      setStatusMessage(`Saved the statement and imported ${res.imported} transaction${res.imported === 1 ? '' : 's'}.`)
    }
    setFile(null)
    setRows([])
    setCardSummary(null)
  }

  const isConfirmDisabled =
    rows.filter((r) => r.include).length === 0 ||
    (kind === 'card' && (!cardSummary?.dueDate || cardSummary?.statementAmount === null)) ||
    confirmBank.isPending ||
    confirmCard.isPending

  return (
    <div className="space-y-6 pb-10">
      <div>
        <h1 className="font-display text-xl font-semibold">Import statements</h1>
        <p className="text-sm text-muted">
          Upload a bank or credit card statement to skip manual entry. You'll always get to review before anything
          is saved.
        </p>
      </div>

      <div className="flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
              kind === tab.key
                ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-500)]/10 text-[var(--color-brand-600)]'
                : 'border-hairline hover:surface-2'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{TABS.find((t) => t.key === kind)?.hint}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Account</Label>
            <Select value={accountId} onChange={(e) => setAccountId(e.target.value)}>
              <option value="">Select an account…</option>
              {relevantAccounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            {relevantAccounts.length === 0 && (
              <p className="mt-1 text-xs text-muted">
                {kind === 'card'
                  ? 'No credit card accounts yet — add one under Accounts first.'
                  : 'No non-card accounts yet — add one under Accounts first.'}
              </p>
            )}
          </div>

          <StatementDropzone file={file} onFileSelected={(f) => { setFile(f); resetResults() }} disabled={!accountId} />

          <Button onClick={handleParse} disabled={!file || !accountId || parseStatement.isPending}>
            {parseStatement.isPending ? 'Parsing…' : 'Parse statement'}
          </Button>

          {parseStatement.isError && (
            <p className="flex items-center gap-2 text-sm text-[var(--color-negative-600)]">
              <AlertTriangle className="h-4 w-4" />
              {(parseStatement.error as Error).message}
            </p>
          )}

          {warnings.length > 0 && (
            <div className="rounded-lg border border-[var(--color-warning-500)]/40 bg-[var(--color-warning-500)]/10 p-3 text-sm space-y-1">
              {warnings.map((w, i) => (
                <p key={i} className="flex gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-warning-500)]" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {kind === 'card' && cardSummary && <CardSummaryForm summary={cardSummary} onChange={setCardSummary} />}

          {rows.length > 0 && (
            <ParsedTransactionsTable
              rows={rows}
              categories={categories ?? []}
              currency={account?.currency ?? 'INR'}
              onToggleRow={(key) =>
                setRows((prev) => prev.map((r) => (r.key === key ? { ...r, include: !r.include } : r)))
              }
              onToggleAll={(include) => setRows((prev) => prev.map((r) => ({ ...r, include })))}
              onCategoryChange={(key, categoryId) =>
                setRows((prev) => prev.map((r) => (r.key === key ? { ...r, categoryId } : r)))
              }
            />
          )}

          {rows.length > 0 && (
            <Button onClick={handleConfirm} disabled={isConfirmDisabled}>
              {confirmBank.isPending || confirmCard.isPending
                ? 'Saving…'
                : `Confirm & import ${rows.filter((r) => r.include).length} transaction${
                    rows.filter((r) => r.include).length === 1 ? '' : 's'
                  }`}
            </Button>
          )}

          {statusMessage && <p className="text-sm text-[var(--color-positive-600)]">{statusMessage}</p>}
        </CardContent>
      </Card>

      <ImportHistoryList />
    </div>
  )
}
