import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchSplitGroups,
  createSplitGroup,
  setParticipantSettled,
  deleteSplitGroup,
  setSplitGroupClosed,
  fetchTotalOwed,
  fetchOwedByPerson,
} from '@/features/splits/api'
import type { NewSplitGroup } from '@/lib/supabase/types'

const SPLITS_KEY = ['split-groups'] as const

export function useSplitGroups() {
  console.log(queryKey, SPLITS_KEY)
  console.log('fetchSplitGroups', fetchSplitGroups)
  return useQuery({ queryKey: SPLITS_KEY, queryFn: fetchSplitGroups })
}

export function useCreateSplitGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewSplitGroup) => createSplitGroup(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPLITS_KEY }),
  })
}

export function useSetParticipantSettled() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isSettled }: { id: string; isSettled: boolean }) => setParticipantSettled(id, isSettled),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPLITS_KEY }),
  })
}

export function useDeleteSplitGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSplitGroup(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPLITS_KEY }),
  })
}

export function useSetSplitGroupClosed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isClosed }: { id: string; isClosed: boolean }) => setSplitGroupClosed(id, isClosed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SPLITS_KEY }),
  })
}

/** Used on the dashboard for the "owed to you" KPI. Shares the same query key
 *  prefix as the splits list so settling/creating a split invalidates this too. */
export function useTotalOwed() {
  return useQuery({ queryKey: [...SPLITS_KEY, 'total-owed'], queryFn: fetchTotalOwed })
}

/** Per-person breakdown of who owes what, for the Splits page summary. */
export function useOwedByPerson() {
  return useQuery({ queryKey: [...SPLITS_KEY, 'owed-by-person'], queryFn: fetchOwedByPerson })
}
