import { Check } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import {
  useSplitGroups,
  useSetSplitGroupClosed,
} from '@/features/splits/hooks'

export function OwedByPersonCard() {
  const { data: groups, isLoading } = useSplitGroups()
  const closeSplit = useSetSplitGroupClosed()

  if (isLoading) return <Skeleton className="h-24" />

  const outstanding = (groups ?? []).flatMap((group) =>
    group.is_closed
      ? []
      : (group.participants ?? [])
          .filter((p) => !p.is_settled)
          .map((p) => ({
            groupId: group.id,
            title: group.title,
            person: p.name,
            amount: p.share_amount,
          })),
  )

  if (outstanding.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="font-display text-lg font-semibold">
        Outstanding Splits
      </h2>

      {outstanding.map((split) => (
        <Card key={`${split.groupId}-${split.person}`}>
          <CardContent className="flex items-center justify-between py-4">
            <div>
              <p className="font-medium">{split.title}</p>
              <p className="text-sm text-muted">
                {split.person} owes you
              </p>
            </div>

            <div className="flex items-center gap-3">
              <span className="font-semibold">
                {formatCurrency(split.amount)}
              </span>

              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  closeSplit.mutate({
                    id: split.groupId,
                    isClosed: true,
                  })
                }
              >
                <Check className="mr-2 h-4 w-4" />
                Close
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
