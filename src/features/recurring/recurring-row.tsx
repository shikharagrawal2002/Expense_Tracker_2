import { Check, Trash2 } from 'lucide-react'
import { Badge } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { daysUntil, type RecurringRule } from '@/features/recurring/api'
import { useDeactivateRecurringRule, useMarkBillPaid } from '@/features/recurring/hooks'

const FREQ_LABEL: Record<string, string> = {
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Biweekly',
  monthly: 'Monthly',
  quarterly: 'Quarterly',
  yearly: 'Yearly',
}

export function RecurringRow({ rule, kind }: { rule: RecurringRule; kind: 'subscription' | 'bill' }) {
  const deactivate = useDeactivateRecurringRule(kind)
  const markPaid = useMarkBillPaid(kind)
  const days = daysUntil(rule.next_due_date)
  const urgent = days <= 3

  const handleMarkPaid = () => {
    markPaid.mutate({ ruleId: rule.id, accountId: rule.account_id })
  }

  return (
    <div className="group flex items-center gap-3 rounded-lg px-2 py-2.5 -mx-2 hover:surface-2 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{rule.label}</p>
        <p className="text-xs text-muted">
          {FREQ_LABEL[rule.frequency]} · {rule.account?.name} · Due{' '}
          {new Date(rule.next_due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      </div>
      <p className="text-sm font-medium num shrink-0">{formatCurrency(rule.amount)}</p>
      <Badge variant={urgent ? 'warning' : 'default'} className="shrink-0">
        {days <= 0 ? 'Due' : `${days}d`}
      </Badge>
      {kind === 'bill' && (
        <button
          onClick={handleMarkPaid}
          disabled={markPaid.isPending}
          className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-positive-500)]/10 text-muted hover:text-[var(--color-positive-600)] transition-all shrink-0"
          aria-label={`Mark ${rule.label} as paid`}
          title="Mark as paid"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        onClick={() => deactivate.mutate(rule.id)}
        className="opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-all shrink-0"
        aria-label={`Remove ${rule.label}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}