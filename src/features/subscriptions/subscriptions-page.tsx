import { Plus, Repeat } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils'
import { useRecurringRules } from '@/features/recurring/hooks'
import { RecurringFormDialog } from '@/features/recurring/recurring-form-dialog'
import { RecurringRow } from '@/features/recurring/recurring-row'

export function SubscriptionsPage() {
  const { data: subs, isLoading, isError } = useRecurringRules('subscription')
  const monthlyTotal = subs?.reduce((sum, s) => sum + s.amount, 0) ?? 0

  return (
    <div className="max-w-[800px] space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Subscriptions</h1>
          {subs && subs.length > 0 && (
            <p className="text-sm text-muted mt-0.5 num">{formatCurrency(monthlyTotal)} recurring per cycle</p>
          )}
        </div>
        <RecurringFormDialog
          kind="subscription"
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add subscription
            </Button>
          }
        />
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading && (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-12" />
              ))}
            </div>
          )}
          {isError && (
            <EmptyState icon={Repeat} title="Couldn't load subscriptions" description="Check your Supabase connection and refresh." />
          )}
          {!isLoading && !isError && subs?.length === 0 && (
            <EmptyState
              icon={Repeat}
              title="No subscriptions tracked"
              description="Add recurring services like Netflix or Spotify to get renewal reminders."
            />
          )}
          {!isLoading && subs && subs.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {subs.map((rule) => (
                <RecurringRow key={rule.id} rule={rule} kind="subscription" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
