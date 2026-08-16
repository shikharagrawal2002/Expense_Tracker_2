import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Landmark, CreditCard, AlertTriangle, Check, Trash2, KeyRound, Loader2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Select } from '@/components/ui/select'
import { Label, Input } from '@/components/ui/input'
import { useAccounts } from '@/features/accounts/hooks'
import { useCategories } from '@/features/categories/hooks'
import { StatementDropzone } from '@/features/imports/statement-dropzone'
import { ParsedTransactionsTable } from '@/features/imports/parsed-transactions-table'
import { CardSummaryForm } from '@/features/imports/card-summary-form'
import { ImportHistoryList } from '@/features/imports/import-history-list'
import {
  useParseStatement,
  useConfirmBankImport,
  useConfirmCardImport,
  useSavedStatementBanks,
  useDeleteSavedStatementBank,
  useSaveStatementPassword,
} from '@/features/imports/hooks'
import { toReviewRow, type ImportKind, type ReviewRow } from '@/features/imports/types'
import type { CardStatementSummary, NewTransaction, BankProvider } from '@/lib/supabase/types'

const BANK_OPTIONS: Array<{ value: BankProvider; label: string }> = [
  { value: 'axis', label: 'Axis Bank' },
  { value: 'hdfc', label: 'HDFC Bank' },
  { value: 'hsbc', label: 'HSBC' },
  { value: 'icici', label: 'ICICI Bank' },
  { value: 'idfc', label: 'IDFC First Bank' },
  { value: 'indusind', label: 'IndusInd Bank' },
  { value: 'sbi', label: 'SBI Card' },
  { value: 'slice', label: 'Slice' },
  { value: 'yesbank', label: 'YES Bank' },
]

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
  const [searchParams, setSearchParams] = useSearchParams()
  const [kind, setKind] = useState<ImportKind>(() => {
    const urlKind = searchParams.get('kind')
    return urlKind === 'card' ? 'card' : 'bank'
  })
  const [accountId, setAccountId] = useState('')
  const [provider, setProvider] = useState<BankProvider>('hsbc')
  const [file, setFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')
  const [passwordSaved, setPasswordSaved] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [rows, setRows] = useState<ReviewRow[]>([])
  const [cardSummary, setCardSummary] = useState<CardStatementSummary | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const { data: savedBanks = [] } = useSavedStatementBanks()
  const deleteSavedBank = useDeleteSavedStatementBank()
  const saveStatementPassword = useSaveStatementPassword()
  const parseStatement = useParseStatement()
  const confirmBank = useConfirmBankImport()
  const confirmCard = useConfirmCardImport()

  const relevantAccounts = useMemo(
    () => (accounts ?? []).filter((a) => (kind === 'card' ? a.type === 'credit_card' : a.type !== 'credit_card')),
    [accounts, kind],
  )

  const account = accounts?.find((a) => a.id === accountId)
  const hasSavedPassword = savedBanks.includes(provider)

  function resetResults() {
    setRows([])
    setCardSummary(null)
    setWarnings([])
    setStatusMessage(null)
  }

  function handleTabChange(nextKind: ImportKind) {
    setKind(nextKind)
    // Keep the URL in sync so mobile shortcuts can deep-link to a specific tab.
    setSearchParams(nextKind === 'card' ? { kind: 'card' } : {}, { replace: true })
    setAccountId('')
    setProvider('hsbc')
    setFile(null)
    setPassword('')
    setPasswordSaved(false)
    setPasswordError(null)
    resetResults()
  }

  function handleProviderChange(nextProvider: BankProvider) {
    setProvider(nextProvider)
    setPassword('')
    setPasswordSaved(false)
    setPasswordError(null)
    resetResults()
  }

  async function handleSavePassword() {
    setPasswordError(null)
    if (!password) return
    try {
      await saveStatementPassword.mutateAsync({ provider, password })
      setPassword('')
      setPasswordSaved(true)
      setTimeout(() => setPasswordSaved(false), 2000)
    } catch (err) {
      setPasswordError((err as Error).message)
    }
  }

  async function handleParse() {
    if (!file || !accountId) return
    resetResults()
    const result = await parseStatement.mutateAsync({
      file,
      kind,
      accountId,
      provider,
      password,
    })
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
        // r.date is a bare "yyyy-mm-dd" string from the parser. Sending that
        // with no timezone marker leaves Postgres to guess — if the DB
        // session's timezone isn't UTC, "2026-07-01" can get interpreted as
        // midnight in THAT timezone and converted to a different UTC instant
        // (e.g. stored as "2026-06-30T18:30:00Z" if the session is IST),
        // which then falls outside a "July" filter entirely. Anchoring to an
        // explicit +05:30 makes the intended local midnight unambiguous.
        occurred_at: `${r.date}T00:00:00+05:30`,
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
          cycle_start_date: cardSummary.cycleStartDate ?? undefined,
          cycle_end_date: cardSummary.cycleEndDate ?? undefined,
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
            <Label>Bank</Label>
            <Select value={provider} onChange={(e) => handleProviderChange(e.target.value as BankProvider)}>
              {BANK_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">
              Picking your bank uses its exact column layout instead of guessing — more reliable if auto-detect
              misses something.
            </p>
          </div>

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

          <StatementDropzone
            file={file}
            onFileSelected={(f) => {
              setFile(f)
              setPassword('')
              setPasswordError(null)
              resetResults()
            }}
            disabled={!accountId}
          />

          {file && /\.(pdf|xls|xlsx)$/i.test(file.name) && (
            <div className="space-y-2">
              <div>
                <Label htmlFor="pdf-password">Statement password (if locked)</Label>
                <Input
                  id="pdf-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    hasSavedPassword
                      ? 'Leave blank to use the saved password for this bank'
                      : 'Leave blank if this PDF/Excel file is not password-protected'
                  }
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted">
                  {hasSavedPassword
                    ? `This bank has a saved password — you can leave this blank and it will be used automatically.`
                    : 'Common for credit card statements — many issuers lock the PDF with your PAN, date of birth, or similar.'}
                </p>
              </div>

              {!hasSavedPassword && password && (
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={handleSavePassword}
                    disabled={saveStatementPassword.isPending}
                  >
                    {saveStatementPassword.isPending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <KeyRound className="h-3.5 w-3.5" />
                    )}
                    {passwordSaved ? (
                      <>
                        <Check className="h-3.5 w-3.5" />
                        Password saved
                      </>
                    ) : (
                      'Save password'
                    )}
                  </Button>
                  <span className="text-xs text-muted">
                    Save this password for <strong>{BANK_OPTIONS.find((b) => b.value === provider)?.label}</strong> statements so you only enter it once. It is encrypted before being stored.
                  </span>
                </div>
              )}
              {passwordError && (
                <p className="text-xs text-[var(--color-negative-600)]">{passwordError}</p>
              )}

              {hasSavedPassword && (
                <div className="flex flex-wrap items-center gap-2 rounded-lg border border-[var(--color-positive-500)]/40 bg-[var(--color-positive-500)]/10 px-3 py-2 text-sm">
                  <Check className="h-4 w-4 shrink-0 text-[var(--color-positive-600)]" />
                  <span className="flex-1 text-muted">
                    Saved password for <strong>{BANK_OPTIONS.find((b) => b.value === provider)?.label}</strong> will be used automatically.
                  </span>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-[var(--color-negative-600)] hover:text-[var(--color-negative-700)]"
                    onClick={() => {
                      deleteSavedBank.mutate(provider)
                      setPassword('')
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Remove
                  </Button>
                </div>
              )}
            </div>
          )}

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