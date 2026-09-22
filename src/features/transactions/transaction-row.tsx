import { useState } from 'react'
import { Trash2, Pencil, ArrowRight, ArrowLeftRight, Users, ChevronDown } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { Badge } from '@/components/ui/skeleton'
import { useDeleteTransaction } from '@/features/transactions/hooks'
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog'
import { SplitFormDialog } from '@/features/splits/split-form-dialog'
import type { Transaction } from '@/lib/supabase/types'

interface TransactionRowProps {
  txn: Transaction
  /** The account currently being viewed (e.g. the Transactions page's account
   *  filter, or an account-detail screen). Used to decide, for a transfer,
   *  whether this account was the source (shows negative) or destination
   *  (shows positive) — a transfer has no inherent sign on its own, it depends
   *  on which side of it you're looking from. */
  viewAccountId?: string
  /** Which transaction types show the "add to split" button. Defaults to
   *  expense-only (the common case — splitting a bill you paid). The Credit
   *  Cards page passes both 'income' and 'expense', since a credit-card
   *  refund/cashback split among people is just as real as a bill split. */
  splitButtonTypes?: Array<Transaction['type']>
}

/** Shared styling for the icon-only action buttons in the mobile panel. */
const actionButtonClass =
  'flex h-9 w-9 items-center justify-center rounded-lg text-muted hover:text-inherit hover:surface transition-colors'

export function TransactionRow({ txn, viewAccountId, splitButtonTypes = ['expense'] }: TransactionRowProps) {
  const deleteTransaction = useDeleteTransaction()
  const [expanded, setExpanded] = useState(false)
  const color = txn.category?.color ?? '#94a3b8'

  let signedAmount = txn.amount
  let amountColorClass = 'text-inherit'

  if (txn.type === 'income') {
    signedAmount = txn.amount
    amountColorClass = 'text-[var(--color-positive-600)]'
  } else if (txn.type === 'expense') {
    signedAmount = -txn.amount
  } else if (txn.type === 'transfer') {
    if (viewAccountId && txn.transfer_account_id === viewAccountId) {
      // We're looking at the destination account: money arrived here.
      signedAmount = txn.amount
      amountColorClass = 'text-[var(--color-positive-600)]'
    } else if (viewAccountId && txn.account_id === viewAccountId) {
      // We're looking at the source account: money left here.
      signedAmount = -txn.amount
    }
    // else: no specific account in view (e.g. "All accounts") — ambiguous which
    // side we're looking from, so leave it unsigned and neutrally colored.
  }

  const subtitleDate = new Date(txn.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })

  const isSourceView = txn.type === 'transfer' && viewAccountId && txn.account_id === viewAccountId
  const isDestinationView = txn.type === 'transfer' && viewAccountId && txn.transfer_account_id === viewAccountId
  const canSplit = splitButtonTypes.includes(txn.type)

  const splitButton = (
    <SplitFormDialog
      presetTransaction={txn}
      trigger={
        <button className={actionButtonClass} aria-label="Split this transaction" title="Split this transaction">
          <Users className="h-4 w-4" />
        </button>
      }
    />
  )

  const editButton = (
    <TransactionFormDialog
      transaction={txn}
      trigger={
        <button className={actionButtonClass} aria-label="Edit transaction" title="Edit transaction">
          <Pencil className="h-4 w-4" />
        </button>
      }
    />
  )

  const deleteButton = (
    <button
      onClick={() => deleteTransaction.mutate(txn.id)}
      className={cn(actionButtonClass, 'hover:bg-[var(--color-negative-500)]/10 hover:text-[var(--color-negative-600)]')}
      aria-label="Delete transaction"
      title="Delete transaction"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )

  return (
    /* Column layout: the transaction line sits on top and the mobile action bar
       opens *below* it, so tapping the arrow grows the card downwards instead of
       squeezing another row of controls in sideways. */
    <div className="group w-full min-w-0 overflow-hidden rounded-lg -mx-2 hover:surface-2 transition-colors">
      {/* The transaction line itself. */}
      <div className="flex items-center gap-3 px-2 py-2.5">
        <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}26` }}>
          {txn.type === 'transfer' ? (
            <ArrowLeftRight className="h-3.5 w-3.5" style={{ color }} />
          ) : (
            <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">
            {txn.category?.name ?? (txn.type === 'transfer' ? 'Transfer' : 'Uncategorized')}
          </p>

          {/* Desktop/tablet subtitle: account + date (+ note) on one line. */}
          <p className="min-w-0 overflow-clip text-ellipsis whitespace-nowrap text-xs text-muted hidden sm:block max-w-[60%]">
            {txn.type === 'transfer' && isSourceView ? (
              <span className="whitespace-normal">To {txn.transfer_account?.name ?? 'Unknown'} · {subtitleDate}</span>
            ) : txn.type === 'transfer' && isDestinationView ? (
              <span className="whitespace-normal">From {txn.account?.name ?? 'Unknown'} · {subtitleDate}</span>
            ) : txn.type === 'transfer' ? (
              <>
                <span className="whitespace-normal">{txn.account?.name ?? 'Unknown'}</span>
                <ArrowRight className="h-3 w-3 shrink-0" />
                <span className="whitespace-normal">{txn.transfer_account?.name ?? 'Unknown'}</span>
                <span>· {subtitleDate}</span>
              </>
            ) : (
              <span className="whitespace-nowrap">
                {txn.account?.name} · {subtitleDate}
                {txn.notes ? ` · ${txn.notes}` : ''}
              </span>
            )}
          </p>

          {/* Mobile subtitle: the note/payee is the most useful second line, and
              falls back to the date when there's nothing to show. */}
          <p className="text-xs text-muted truncate sm:hidden">
            {txn.notes || subtitleDate}
          </p>
        </div>

        {txn.split_status && (
          <>
            <Badge
              variant={txn.split_status === 'open' ? 'default' : 'warning'}
              className="shrink-0 hidden sm:flex"
            >
              <Users className="h-3 w-3" />
              {txn.split_status === 'open' ? 'Open' : 'Closed'}
            </Badge>
            {/* On phones a full badge would crowd the row — a tiny icon marks it. */}
            <Users
              className={cn(
                'h-3.5 w-3.5 shrink-0 sm:hidden',
                txn.split_status === 'open' ? 'text-[var(--color-brand-500)]' : 'text-muted',
              )}
              aria-label={txn.split_status === 'open' ? 'Split open' : 'Split closed'}
            />
          </>
        )}

        <p className={cn('text-right text-sm font-medium num shrink-0', amountColorClass)}>
          {signedAmount > 0 ? '+' : ''}
          {formatCurrency(signedAmount, txn.currency)}
        </p>

        {/* Desktop/tablet: actions revealed on hover, as before. */}
        <div className="hidden sm:flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          {canSplit && splitButton}
          {editButton}
          {deleteButton}
        </div>

        {/* Mobile: arrow-only toggle — no text, and it rotates as it opens. */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="sm:hidden shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-inherit hover:surface transition-colors"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide transaction actions' : 'Show transaction actions'}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')} />
        </button>
      </div>

      {/* Mobile: the action bar, icon-only, expanding the card downwards. */}
      {expanded && (
        <div className="sm:hidden flex items-center justify-end gap-1.5 border-t border-hairline px-2 py-1.5 animate-in slide-in-from-top-1 fade-in duration-200">
          {canSplit && splitButton}
          {editButton}
          {deleteButton}
        </div>
      )}
    </div>
  )
}
