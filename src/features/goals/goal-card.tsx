import { Trash2, Plus, Target as TargetIcon } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Button } from '@/components/ui/button'
import { formatCurrency } from '@/lib/utils'
import { useDeleteGoal } from '@/features/goals/hooks'
import { ContributeDialog } from '@/features/goals/contribute-dialog'
import type { Goal } from '@/features/goals/api'

export function GoalCard({ goal }: { goal: Goal }) {
  const deleteGoal = useDeleteGoal()
  const pct = goal.target_amount > 0 ? Math.min(100, Math.round((goal.current_amount / goal.target_amount) * 100)) : 0
  const remaining = Math.max(0, goal.target_amount - goal.current_amount)

  return (
    <Card className="group relative">
      <button
        onClick={() => deleteGoal.mutate(goal.id)}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 rounded-lg p-1.5 hover:bg-[var(--color-negative-500)]/10 text-muted hover:text-[var(--color-negative-600)] transition-all"
        aria-label={`Delete ${goal.name}`}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
      <CardContent className="pt-5">
        <div className="flex items-center gap-4">
          <ProgressRing value={pct} size={72} strokeWidth={7} color={goal.color}>
            <span className="text-sm font-semibold num">{pct}%</span>
          </ProgressRing>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-xs text-muted mb-0.5">
              <TargetIcon className="h-3 w-3" />
              {goal.goal_type.replace('_', ' ')}
            </div>
            <p className="text-sm font-medium truncate">{goal.name}</p>
            <p className="text-xs num text-muted mt-0.5">
              {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-muted num">
            {remaining > 0 ? `${formatCurrency(remaining)} to go` : 'Goal reached 🎉'}
          </p>
          <ContributeDialog
            goal={goal}
            trigger={
              <Button size="sm" variant="secondary">
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            }
          />
        </div>
      </CardContent>
    </Card>
  )
}
