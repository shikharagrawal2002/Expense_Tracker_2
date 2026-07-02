import { Plus, ReceiptText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils'
import { useRecurringRules } from '@/features/recurring/hooks'
import { RecurringFormDialog } from '@/features/recurring/recurring-form-dialog'
import { RecurringRow } from '@/features/recurring/recurring-row'

export function BillsPage() {
  const { data: bills, isLoading, isError } = useRecurringRules('bill')
  const monthlyTotal = bills?.reduce((sum, b) => sum + b.amount, 0) ?? 0

  return (
    <div className="max-w-[800px] space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Bills</h1>
          {bills && bills.length > 0 && (
            <p className="text-sm text-muted mt-0.5 num">{formatCurrency(monthlyTotal)} due per cycle</p>
          )}
        </div>
        <RecurringFormDialog
          kind="bill"
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add bill
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
            <EmptyState icon={ReceiptText} title="Couldn't load bills" description="Check your Supabase connection and refresh." />
          )}
          {!isLoading && !isError && bills?.length === 0 && (
            <EmptyState icon={ReceiptText} title="No bills tracked" description="Add recurring bills like rent or utilities to get due-date reminders." />
          )}
          {!isLoading && bills && bills.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {bills.map((rule) => (
                <RecurringRow key={rule.id} rule={rule} kind="bill" />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
