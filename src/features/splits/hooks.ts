import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchSplitGroups,
  createSplitGroup,
  setParticipantSettled,
  deleteSplitGroup,
  setSplitGroupClosed,
  fetchTotalOwed
} from '@/features/splits/api'
import type { NewSplitGroup, SplitGroup } from '@/lib/supabase/types'

const SPLITS_KEY = ['split-groups'] as const

export function useSplitGroups() {
  return useQuery({ queryKey: SPLITS_KEY, queryFn: fetchSplitGroups })
}

export function useCreateSplitGroup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewSplitGroup) => createSplitGroup(input),
    onMutate: async (input) => {
      await queryClient.cancelQueries({ queryKey: SPLITS_KEY })
      const previous = queryClient.getQueryData<SplitGroup[]>(SPLITS_KEY)
      const optimisticGroup: SplitGroup = {
        id: `optimistic-${Date.now()}`,
        user_id: 'pending',
        transaction_id: input.transaction_id ?? null,
        title: input.title,
        total_amount: input.total_amount,
        created_at: new Date().toISOString(),
        is_closed: false,
        closed_at: null,
        participants: input.participants.map((p, index) => ({
          id: `optimistic-participant-${Date.now()}-${index}`,
          split_group_id: `optimistic-${Date.now()}`,
          name: p.name,
          share_amount: p.share_amount,
          is_settled: false,
          settled_at: null,
        })),
      }

      queryClient.setQueryData<SplitGroup[]>(SPLITS_KEY, (old) => [optimisticGroup, ...(old ?? [])])
      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context?.previous) {
        queryClient.setQueryData<SplitGroup[]>(SPLITS_KEY, context.previous)
      }
    },
    onSuccess: (createdGroup) => {
      queryClient.setQueryData<SplitGroup[]>(SPLITS_KEY, (old) => {
        const filtered = (old ?? []).filter((group) => !group.id.startsWith('optimistic-'))
        return [createdGroup, ...filtered]
      })
      queryClient.invalidateQueries({ queryKey: SPLITS_KEY })
    },
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
