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
      input.participants.map((p, index) => ({
        split_group_id: group.id,
        name: p.name,
        share_amount: p.share_amount,
        is_settled: false,
        settled_at: null,
        // temporary client-side id for the optimistic UI path; the DB will assign its own id
        id: `local-participant-${Date.now()}-${index}`,
      })),
    )
    if (participantsError) throw participantsError
  }

  return {
    ...group,
    is_closed: false,
    closed_at: null,
    participants: input.participants.map((p, index) => ({
      id: `local-participant-${Date.now()}-${index}`,
      split_group_id: group.id,
      name: p.name,
      share_amount: p.share_amount,
      is_settled: false,
      settled_at: null,
    })),
  } as SplitGroup
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

/** Closes (or reopens) a split without deleting it — keeps the record and
 *  participant history, just marks it done and out of the default view. */
export async function setSplitGroupClosed(id: string, isClosed: boolean): Promise<void> {
  const { error } = await supabase
    .from('split_groups')
    .update({ is_closed: isClosed, closed_at: isClosed ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) throw error
}

/** Total across every unsettled participant share, across all your splits —
 *  RLS on split_participants already scopes this to groups you own, via the
 *  "own split_participants" policy joining through split_groups.user_id. */
export async function fetchTotalOwed(): Promise<number> {
  const { data, error } = await supabase.from('split_participants').select('share_amount').eq('is_settled', false)
  if (error) throw error
  return (data ?? []).reduce((sum, p) => sum + Number(p.share_amount), 0)
}

export interface OwedByPerson {
  name: string
  amount: number
}
