import { Trash2, Pencil, ArrowRight, ArrowLeftRight } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useDeleteTransaction } from '@/features/transactions/hooks'
import { TransactionFormDialog } from '@/features/transactions/transaction-form-dialog'
import type { Transaction } from '@/lib/supabase/types'

interface TransactionRowProps {
  txn: Transaction
  /** The account currently being viewed (e.g. the Transactions page's account
   *  filter, or an account-detail screen). Used to decide, for a transfer,
   *  whether this account was the source (shows negative) or destination
   *  (shows positive) — a transfer has no inherent sign on its own, it depends
   *  on which side of it you're looking from. */
  viewAccountId?: string
}

export function TransactionRow({ txn, viewAccountId }: TransactionRowProps) {
  const deleteTransaction = useDeleteTransaction()
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

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:surface-2 transition-colors">
      <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}26` }}>
        {txn.type === 'transfer' ? (
          <ArrowLeftRight className="h-3.5 w-3.5" style={{ color }} />
        ) : (
          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{txn.category?.name ?? (txn.type === 'transfer' ? 'Transfer' : 'Uncategorized')}</p>
        <p className="text-xs text-muted truncate flex items-center gap-1">
          {txn.type === 'transfer' && isSourceView ? (
            <span className="truncate">To {txn.transfer_account?.name ?? 'Unknown'} · {subtitleDate}</span>
          ) : txn.type === 'transfer' && isDestinationView ? (
            <span className="truncate">From {txn.account?.name ?? 'Unknown'} · {subtitleDate}</span>
          ) : txn.type === 'transfer' ? (
            <>
              <span className="truncate">{txn.account?.name ?? 'Unknown'}</span>
              <ArrowRight className="h-3 w-3 shrink-0" />
              <span className="truncate">{txn.transfer_account?.name ?? 'Unknown'}</span>
              <span>· {subtitleDate}</span>
            </>
          ) : (
            <span className="truncate">
              {txn.account?.name} · {subtitleDate}
              {txn.notes ? ` · ${txn.notes}` : ''}
            </span>
          )}
        </p>
      </div>
      <p className={cn('text-sm font-medium num shrink-0', amountColorClass)}>
        {signedAmount > 0 ? '+' : ''}
        {formatCurrency(signedAmount, txn.currency)}
      </p>
      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        <TransactionFormDialog
          transaction={txn}
          trigger={
            <button
              className="rounded-lg p-1.5 hover:surface text-muted hover:text-inherit transition-colors"
              aria-label="Edit transaction"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          }
        />
        <button
          onClick={() => deleteTransaction.mutate(txn.id)}
          className="rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-colors"
          aria-label="Delete transaction"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
