import { supabase } from '@/lib/supabase/client'
import type { SplitGroup, NewSplitGroup, SplitParticipant } from '@/lib/supabase/types'

const SELECT_WITH_JOINS =
  '*, transaction:transactions(id,amount,occurred_at,notes,currency,account:accounts(id,name)), participants:split_participants(*)'

export async function fetchSplitGroups(): Promise<SplitGroup[]> {
  const { data, error } = await supabase
    .from('split_groups')
    .select(SELECT_WITH_JOINS)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data as unknown as SplitGroup[]
}

export async function createSplitGroup(input: NewSplitGroup): Promise<SplitGroup> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data: group, error: groupError } = await supabase
    .from('split_groups')
    .insert({
      user_id: userId,
      title: input.title,
      total_amount: input.total_amount,
      transaction_id: input.transaction_id ?? null,
    })
    .select('*')
    .single()
  if (groupError) throw groupError

  if (input.participants.length > 0) {
    const { error: participantsError } = await supabase.from('split_participants').insert(
      input.participants.map((p) => ({
        split_group_id: group.id,
        name: p.name,
        share_amount: p.share_amount,
      })),
    )
    if (participantsError) throw participantsError
  }

  return group as SplitGroup
}

export async function setParticipantSettled(id: string, isSettled: boolean): Promise<SplitParticipant> {
  const { data, error } = await supabase
    .from('split_participants')
    .update({ is_settled: isSettled, settled_at: isSettled ? new Date().toISOString() : null })
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as SplitParticipant
}

export async function deleteSplitGroup(id: string): Promise<void> {
  const { error } = await supabase.from('split_groups').delete().eq('id', id)
  if (error) throw error
}
