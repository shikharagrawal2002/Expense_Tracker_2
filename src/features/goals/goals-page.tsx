import { Plus, Target } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useGoals } from '@/features/goals/hooks'
import { GoalCard } from '@/features/goals/goal-card'
import { GoalFormDialog } from '@/features/goals/goal-form-dialog'

export function GoalsPage() {
  const { data: goals, isLoading, isError } = useGoals()

  return (
    <div className="max-w-[1200px] space-y-6">
      <div className="flex items-start justify-between">
        <h1 className="font-display text-2xl font-semibold">Goals</h1>
        <GoalFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              New goal
            </Button>
          }
        />
      </div>

      {isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-2xl" />
          ))}
        </div>
      )}

      {isError && (
        <Card>
          <EmptyState icon={Target} title="Couldn't load goals" description="Check your Supabase connection and refresh." />
        </Card>
      )}

      {!isLoading && !isError && goals?.length === 0 && (
        <Card>
          <EmptyState
            icon={Target}
            title="No goals yet"
            description="Set a savings goal or emergency fund target and track your progress toward it."
          />
        </Card>
      )}

      {!isLoading && goals && goals.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => (
            <GoalCard key={goal.id} goal={goal} />
          ))}
        </div>
      )}
    </div>
  )
}
