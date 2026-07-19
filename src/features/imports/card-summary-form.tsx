import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/skeleton'
import type { CardStatementSummary } from '@/lib/supabase/types'

interface CardSummaryFormProps {
  summary: CardStatementSummary
  onChange: (summary: CardStatementSummary) => void
}

export function CardSummaryForm({ summary, onChange }: CardSummaryFormProps) {
  const missingDueDate = !summary.dueDate
  const missingAmount = summary.statementAmount === null

  return (
    <div className="rounded-xl border border-hairline p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="font-display text-sm font-medium">Statement summary</p>
        {(missingDueDate || missingAmount) && <Badge variant="warning">Please confirm below</Badge>}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Statement month</Label>
          <Input
            type="month"
            value={summary.statementMonth.slice(0, 7)}
            onChange={(e) => onChange({ ...summary, statementMonth: `${e.target.value}-01` })}
          />
        </div>
        <div>
          <Label>Statement date</Label>
          <Input
            type="date"
            value={summary.statementDate ?? ''}
            onChange={(e) => onChange({ ...summary, statementDate: e.target.value || null })}
          />
        </div>
        <div>
          <Label>Due date {missingDueDate && <span className="text-[var(--color-negative-600)]">*</span>}</Label>
          <Input
            type="date"
            value={summary.dueDate ?? ''}
            onChange={(e) => onChange({ ...summary, dueDate: e.target.value || null })}
          />
        </div>
        <div>
          <Label>
            Total amount due {missingAmount && <span className="text-[var(--color-negative-600)]">*</span>}
          </Label>
          <Input
            type="number"
            step="0.01"
            value={summary.statementAmount ?? ''}
            onChange={(e) =>
              onChange({ ...summary, statementAmount: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label>Minimum due (optional)</Label>
          <Input
            type="number"
            step="0.01"
            value={summary.minimumDue ?? ''}
            onChange={(e) =>
              onChange({ ...summary, minimumDue: e.target.value === '' ? null : Number(e.target.value) })
            }
          />
        </div>
      </div>
    </div>
  )
}
