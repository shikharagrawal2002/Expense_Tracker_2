import { Trash2 } from 'lucide-react'
import { formatCurrency, cn } from '@/lib/utils'
import { useDeleteTransaction } from '@/features/transactions/hooks'
import type { Transaction } from '@/lib/supabase/types'

export function TransactionRow({ txn }: { txn: Transaction }) {
  const deleteTransaction = useDeleteTransaction()
  const signedAmount = txn.type === 'income' ? txn.amount : txn.type === 'expense' ? -txn.amount : txn.amount
  const color = txn.category?.color ?? '#94a3b8'

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:surface-2 transition-colors">
      <div className="h-8 w-8 rounded-full shrink-0 flex items-center justify-center" style={{ backgroundColor: `${color}26` }}>
        <div className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{txn.category?.name ?? 'Uncategorized'}</p>
        <p className="text-xs text-muted truncate">
          {txn.account?.name} · {new Date(txn.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
          {txn.notes ? ` · ${txn.notes}` : ''}
        </p>
      </div>
      <p
        className={cn(
          'text-sm font-medium num shrink-0',
          txn.type === 'income' ? 'text-[var(--color-positive-600)]' : 'text-inherit',
        )}
      >
        {signedAmount > 0 ? '+' : ''}
        {formatCurrency(signedAmount, txn.currency)}
      </p>
      <button
        onClick={() => deleteTransaction.mutate(txn.id)}
        className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-all shrink-0"
        aria-label="Delete transaction"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
