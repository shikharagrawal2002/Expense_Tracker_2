import { supabase } from '@/lib/supabase/client'

export type GoalType = 'savings' | 'emergency_fund' | 'debt_payoff' | 'custom'

export interface Goal {
  id: string
  user_id: string
  name: string
  goal_type: GoalType
  target_amount: number
  current_amount: number
  target_date: string | null
  color: string
  icon: string
  is_achieved: boolean
  created_at: string
}

export interface NewGoal {
  name: string
  goal_type: GoalType
  target_amount: number
  target_date?: string | null
  color?: string
}

export async function fetchGoals(): Promise<Goal[]> {
  const { data, error } = await supabase.from('goals').select('*').order('created_at', { ascending: true })
  if (error) throw error
  return data as Goal[]
}

export async function createGoal(input: NewGoal): Promise<Goal> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('goals')
    .insert({ ...input, user_id: userId, current_amount: 0 })
    .select('*')
    .single()
  if (error) throw error
  return data as Goal
}

export async function deleteGoal(id: string): Promise<void> {
  const { error } = await supabase.from('goals').delete().eq('id', id)
  if (error) throw error
}

export async function contributeToGoal(goalId: string, amount: number, currentAmount: number): Promise<void> {
  const nextAmount = currentAmount + amount
  const { error: goalError } = await supabase
    .from('goals')
    .update({ current_amount: nextAmount })
    .eq('id', goalId)
  if (goalError) throw goalError

  const { error: contribError } = await supabase.from('goal_contributions').insert({ goal_id: goalId, amount })
  if (contribError) throw contribError
}
