import { supabase } from '@/lib/supabase/client'
import { addDays, toDateKey, todayKey } from '@/features/tasks/task-dates'
import type { Task, NewTask, TaskUpdate, TaskPriority } from '@/lib/supabase/types'

export type TaskStatusFilter = 'all' | 'pending' | 'done'

export interface TaskFilters {
  /** 'pending' | 'done' hide the other half; 'all' shows everything. */
  status?: TaskStatusFilter
  priority?: TaskPriority | 'all'
  /** Inclusive 'YYYY-MM-DD' bounds applied to `due_date`. */
  dateFrom?: string
  dateTo?: string
  /** `false` narrows to tasks with no due date at all (the "someday" pile). */
  hasDueDate?: boolean
  search?: string
}

export interface TaskStats {
  total: number
  pending: number
  done: number
  overdue: number
  dueToday: number
  dueThisWeek: number
  completionPct: number
}

/** A search term goes into a PostgREST `or(...)` filter, where `,` separates
 *  conditions and `%` is the ilike wildcard — strip both so a stray character
 *  can't change the shape of the query. */
function sanitizeSearch(term: string) {
  return term.replace(/[,%()]/g, ' ').trim()
}

export async function fetchTasks(filters: TaskFilters = {}): Promise<Task[]> {
  let query = supabase.from('tasks').select('*')

  if (filters.status === 'pending') query = query.eq('is_done', false)
  if (filters.status === 'done') query = query.eq('is_done', true)
  if (filters.priority && filters.priority !== 'all') query = query.eq('priority', filters.priority)
  if (filters.dateFrom) query = query.gte('due_date', filters.dateFrom)
  if (filters.dateTo) query = query.lte('due_date', filters.dateTo)
  if (filters.hasDueDate === false) query = query.is('due_date', null)

  const search = filters.search ? sanitizeSearch(filters.search) : ''
  if (search) query = query.or(`title.ilike.%${search}%,notes.ilike.%${search}%`)

  // Open tasks first, then soonest due date, then newest — the order the page
  // renders before it re-buckets into Overdue / Today / … sections.
  const { data, error } = await query
    .order('is_done', { ascending: true })
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })

  if (error) throw error
  return data as Task[]
}

/** Counters for the summary cards — reads only the columns it needs so the
 *  numbers stay correct regardless of the filters applied to the list. */
export async function fetchTaskStats(): Promise<TaskStats> {
  const { data, error } = await supabase.from('tasks').select('is_done, due_date')
  if (error) throw error

  const rows = data as Pick<Task, 'is_done' | 'due_date'>[]
  const stats: TaskStats = {
    total: rows.length,
    pending: 0,
    done: 0,
    overdue: 0,
    dueToday: 0,
    dueThisWeek: 0,
    completionPct: 0,
  }

  const todayIso = todayKey()
  const weekIso = toDateKey(addDays(new Date(), 7))

  for (const row of rows) {
    if (row.is_done) {
      stats.done += 1
      continue
    }
    stats.pending += 1
    if (!row.due_date) continue

    // 'YYYY-MM-DD' strings sort chronologically, so these comparisons match
    // exactly what the "Overdue" / "Due today" / "Next 7 days" tiles filter to
    // — tile counts and the filtered list can never disagree.
    if (row.due_date < todayIso) stats.overdue += 1
    else if (row.due_date === todayIso) stats.dueToday += 1
    if (row.due_date >= todayIso && row.due_date <= weekIso) stats.dueThisWeek += 1
  }

  stats.completionPct = stats.total === 0 ? 0 : Math.round((stats.done / stats.total) * 100)
  return stats
}

async function requireUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser()
  if (error) throw error
  const userId = data.user?.id
  if (!userId) throw new Error('Not authenticated')
  return userId
}

export async function createTask(input: NewTask): Promise<Task> {
  const userId = await requireUserId()
  const { data, error } = await supabase
    .from('tasks')
    .insert({
      user_id: userId,
      title: input.title,
      notes: input.notes ?? null,
      due_date: input.due_date ?? null,
      priority: input.priority ?? 'medium',
    })
    .select('*')
    .single()
  if (error) throw error
  return data as Task
}

export async function updateTask(id: string, patch: TaskUpdate): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()
  if (error) throw error
  return data as Task
}

/** Ticking a task off stamps `completed_at`; reopening clears it. */
export async function setTaskDone(id: string, isDone: boolean): Promise<Task> {
  return updateTask(id, {
    is_done: isDone,
    completed_at: isDone ? new Date().toISOString() : null,
  })
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
