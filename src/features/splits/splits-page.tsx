// @ts-nocheck
import { useState } from 'react'
import { Plus, Users, Trash2, Check, Archive, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency, cn } from '@/lib/utils'
import { useSplitGroups, useSetParticipantSettled, useDeleteSplitGroup, useSetSplitGroupClosed } from '@/features/splits/hooks'
import { SplitFormDialog } from '@/features/splits/split-form-dialog'
import { OwedByPersonCard } from '@/features/splits/owed-by-person-card'

export function SplitsPage() {
  const [tab, setTab] = useState<'open' | 'closed'>('open')
  const { data: splitGroups, isLoading } = useSplitGroups()
  const setParticipantSettled = useSetParticipantSettled()
  const deleteSplitGroup = useDeleteSplitGroup()
  const setSplitGroupClosed = useSetSplitGroupClosed()

  const visibleGroups = splitGroups?.filter((g) => (tab === 'open' ? !g.is_closed : g.is_closed))

  const sortedGroups = visibleGroups?.sort((a, b) => {
    return new Date(a.transaction.occurred_at).getTime() - new Date(b.transaction.occurred_at).getTime()
  })

  return (
    <div className="max-w-[800px] space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Splits</h1>
          <p className="text-sm text-muted">Track shared expenses and who still owes you.</p>
        </div>
        <SplitFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New split
            </Button>
          }
        />
      </div>

      <OwedByPersonCard />

      <div className="flex gap-1.5 surface-2 rounded-lg p-1 w-fit">
        {(['open', 'closed'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-medium capitalize transition-colors',
              tab === t ? 'surface shadow-sm' : 'text-muted',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {!isLoading && sortedGroups?.length === 0 && (
        <EmptyState
          icon={Users}
          title={tab === 'open' ? 'No open splits' : 'No closed splits'}
          description={
            tab === 'open'
              ? "Split an expense with friends or family and keep track of who's paid you back."
              : "Splits you've closed will show up here, still fully intact — closing just clears them off your main list."
          }
        />
      )}

      {!isLoading &&
        sortedGroups?.map((group) => {
          const settledCount = group.participants?.filter((p) => p.is_settled).length ?? 0
          const totalParticipants = group.participants?.length ?? 0
          const owedTotal =
            group.participants?.filter((p) => !p.is_settled).reduce((sum, p) => sum + p.share_amount, 0) ?? 0

          return (
            <Card key={group.id} className={group.is_closed ? 'opacity-70' : undefined}>
              <CardContent className="pt-4 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-display text-base font-semibold truncate">{group.title}</p>
                    <p className="text-xs text-muted">
                      {new Date(group.transaction.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {group.transaction && (
                        <>
                          {' '}
                          · linked to{' '}
                          {group.transaction.notes || formatCurrency(group.transaction.amount, group.transaction.currency)}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {group.is_closed ? (
                      <Badge>Closed</Badge>
                    ) : (
                      <Badge variant={owedTotal === 0 ? 'positive' : 'default'}>
                        {owedTotal === 0 ? 'All settled' : `${formatCurrency(owedTotal)} pending`}
                      </Badge>
                    )}
                    <button
                      onClick={() => setSplitGroupClosed.mutate({ id: group.id, isClosed: !group.is_closed })}
                      className="rounded-lg p-1.5 text-muted hover:surface-2 transition-colors"
                      aria-label={group.is_closed ? 'Reopen split' : 'Close split'}
                      title={group.is_closed ? 'Reopen split' : 'Close split'}
                    >
                      {group.is_closed ? <RotateCcw className="h-3.5 w-3.5" /> : <Archive className="h-3.5 w-3.5" />}
                    </button>
                    <button
                      onClick={() => deleteSplitGroup.mutate(group.id)}
                      className="rounded-lg p-1.5 text-muted hover:bg-[var(--color-negative-500)]/10 hover:text-[var(--color-negative-600)] transition-colors"
                      aria-label="Delete split"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted">Total bill</span>
                  <span className="font-medium num">{formatCurrency(group.total_amount)}</span>
                </div>

                <div className="space-y-1.5 pt-1 border-t border-hairline">
                  {group.participants?.map((p) => (
                    <div key={p.id} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <button
                          onClick={() => setParticipantSettled.mutate({ id: p.id, isSettled: !p.is_settled })}
                          className={cn(
                            'h-5 w-5 rounded-full border flex items-center justify-center shrink-0 transition-colors',
                            p.is_settled
                              ? 'bg-[var(--color-positive-500)] border-[var(--color-positive-500)]'
                              : 'border-hairline hover:border-[var(--color-brand-500)]',
                          )}
                          aria-label={p.is_settled ? 'Mark as unpaid' : 'Mark as paid'}
                        >
                          {p.is_settled && <Check className="h-3 w-3 text-white" />}
                        </button>
                        <span className={cn('text-sm truncate', p.is_settled && 'text-muted line-through')}>{p.name}</span>
                      </div>
                      <span className={cn('text-sm num shrink-0', p.is_settled && 'text-muted')}>
                        {formatCurrency(p.share_amount)}
                      </span>
                    </div>
                  ))}
                </div>

                {totalParticipants > 0 && (
                  <p className="text-xs text-muted">
                    {settledCount} of {totalParticipants} paid
                  </p>
                )}
              </CardContent>
            </Card>
          )
        })}
    </div>
  )
}
