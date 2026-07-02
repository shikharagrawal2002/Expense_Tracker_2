import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchGoals, createGoal, deleteGoal, contributeToGoal, type NewGoal, type Goal } from '@/features/goals/api'

const GOALS_KEY = ['goals'] as const

export function useGoals() {
  return useQuery({ queryKey: GOALS_KEY, queryFn: fetchGoals })
}

export function useCreateGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewGoal) => createGoal(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  })
}

export function useDeleteGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteGoal(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  })
}

export function useContributeToGoal() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ goal, amount }: { goal: Goal; amount: number }) =>
      contributeToGoal(goal.id, amount, goal.current_amount),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: GOALS_KEY }),
  })
}
