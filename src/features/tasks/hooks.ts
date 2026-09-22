import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  createTask,
  deleteTask,
  fetchTaskStats,
  fetchTasks,
  setTaskDone,
  updateTask,
  type TaskFilters,
} from '@/features/tasks/api'
import type { NewTask, Task, TaskUpdate } from '@/lib/supabase/types'

/** Every task mutation invalidates both the filtered lists and the summary
 *  counters, so a tick on one card updates the progress bar in the same tick. */
export const TASKS_QUERY_KEY = ['tasks']
export const TASK_STATS_QUERY_KEY = ['task-stats']

function invalidateTaskData(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: TASKS_QUERY_KEY })
  queryClient.invalidateQueries({ queryKey: TASK_STATS_QUERY_KEY })
}

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: ['tasks', filters],
    queryFn: () => fetchTasks(filters),
  })
}

export function useTaskStats() {
  return useQuery({
    queryKey: TASK_STATS_QUERY_KEY,
    queryFn: fetchTaskStats,
  })
}

export function useCreateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewTask) => createTask(input),
    onSuccess: () => invalidateTaskData(queryClient),
  })
}

export function useUpdateTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...patch }: { id: string } & TaskUpdate) => updateTask(id, patch),
    onSuccess: () => invalidateTaskData(queryClient),
  })
}

/** Tick / untick a task. The checkbox flips instantly via an optimistic cache
 *  update, and rolls back if the write fails — waiting on the round trip makes
 *  the checkbox feel broken on a slow connection. */
export function useToggleTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isDone }: { id: string; isDone: boolean }) => setTaskDone(id, isDone),
    onMutate: async ({ id, isDone }) => {
      await queryClient.cancelQueries({ queryKey: TASKS_QUERY_KEY })
      const snapshots = queryClient.getQueriesData<Task[]>({ queryKey: TASKS_QUERY_KEY })

      queryClient.setQueriesData<Task[]>({ queryKey: TASKS_QUERY_KEY }, (tasks) =>
        tasks?.map((task) =>
          task.id === id
            ? { ...task, is_done: isDone, completed_at: isDone ? new Date().toISOString() : null }
            : task,
        ),
      )

      return { snapshots }
    },
    onError: (_error, _variables, context) => {
      for (const [key, data] of context?.snapshots ?? []) {
        queryClient.setQueryData(key, data)
      }
    },
    onSettled: () => invalidateTaskData(queryClient),
  })
}

export function useDeleteTask() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => invalidateTaskData(queryClient),
  })
}
