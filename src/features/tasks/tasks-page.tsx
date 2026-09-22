import { useMemo, useState } from 'react'
import { ListTodo, Plus, Loader2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useCreateTask, useTaskStats, useTasks } from '@/features/tasks/hooks'
import { TaskFormDialog } from '@/features/tasks/task-form-dialog'
import { TaskFilterBar } from '@/features/tasks/task-filter-bar'
import { TaskRow } from '@/features/tasks/task-row'
import { TaskSummary, type StatKey } from '@/features/tasks/task-summary'
import {
  DUE_BUCKET_LABEL,
  DUE_BUCKET_ORDER,
  dueBucket,
  resolveDatePreset,
  type DueBucket,
  type TaskDatePreset,
} from '@/features/tasks/task-dates'
import type { TaskFilters, TaskStatusFilter } from '@/features/tasks/api'
import type { Task, TaskPriority } from '@/lib/supabase/types'

/** Inline "type and hit enter" composer above the list — the fastest path for
 *  capturing a task, which is the whole point of a to-do list. */
function QuickAdd() {
  const [title, setTitle] = useState('')
  const createTask = useCreateTask()

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    // Clear only once the insert lands, and only if the field still holds what
    // was submitted — so a failed add doesn't silently eat what was typed.
    createTask.mutate(
      { title: trimmed },
      { onSuccess: () => setTitle((current) => (current === trimmed ? '' : current)) },
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <div className="relative flex-1">
        <Plus className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <Input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Add a task and press Enter…"
          aria-label="New task title"
          maxLength={200}
          className="pl-9"
        />
      </div>
      <Button type="submit" disabled={!title.trim() || createTask.isPending}>
        {createTask.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        <span className="hidden sm:inline">Add</span>
      </Button>
      {createTask.isError && <AlertTriangle className="h-4 w-4 shrink-0 text-[var(--color-negative-600)]" />}
    </form>
  )
}

/** Which filter set each summary tile corresponds to. */
const STAT_FILTERS: Record<StatKey, { datePreset: TaskDatePreset }> = {
  pending: { datePreset: 'all' },
  overdue: { datePreset: 'overdue' },
  today: { datePreset: 'today' },
  week: { datePreset: 'next7' },
}

export function TasksPage() {
  const [search, setSearch] = useState('')
  // Default to Pending: a to-do list is about what's left, not what's finished.
  const [status, setStatus] = useState<TaskStatusFilter>('pending')
  const [priority, setPriority] = useState<TaskPriority | 'all'>('all')
  const [datePreset, setDatePreset] = useState<TaskDatePreset>('all')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')

  const filters = useMemo<TaskFilters>(() => {
    return {
      status,
      priority,
      search: search.trim() || undefined,
      ...resolveDatePreset(datePreset, customFrom, customTo),
    }
  }, [status, priority, search, datePreset, customFrom, customTo])

  const { data: tasks, isLoading, isError } = useTasks(filters)
  const { data: stats, isLoading: statsLoading } = useTaskStats()

  // Derived rather than stored, so the highlighted tile always matches what's
  // actually on screen (and clears itself as soon as a filter changes).
  const activeStat = useMemo<StatKey | undefined>(() => {
    if (priority !== 'all' || search.trim()) return undefined
    if (status !== 'pending') return undefined
    const match = (Object.keys(STAT_FILTERS) as StatKey[]).find(
      (key) => STAT_FILTERS[key].datePreset === datePreset,
    )
    return match
  }, [priority, search, status, datePreset])

  const handleSelectStat = (key: StatKey) => {
    if (activeStat === key) {
      setDatePreset('all')
      return
    }
    setStatus('pending')
    setPriority('all')
    setSearch('')
    setDatePreset(STAT_FILTERS[key].datePreset)
  }

  const handleClear = () => {
    setSearch('')
    setStatus('pending')
    setPriority('all')
    setDatePreset('all')
    setCustomFrom('')
    setCustomTo('')
  }

  const hasActiveFilters = Boolean(
    search.trim() || priority !== 'all' || datePreset !== 'all' || status !== 'pending',
  )

  // Bucket into Overdue / Today / Next 7 days / … sections, dropping empty ones.
  const groups = useMemo(() => {
    if (!tasks) return [] as Array<{ bucket: DueBucket; items: Task[] }>
    const byBucket = new Map<DueBucket, Task[]>()
    for (const task of tasks) {
      const bucket = dueBucket(task.due_date, task.is_done)
      const list = byBucket.get(bucket)
      if (list) list.push(task)
      else byBucket.set(bucket, [task])
    }
    return DUE_BUCKET_ORDER.filter((bucket) => byBucket.has(bucket)).map((bucket) => ({
      bucket,
      items: byBucket.get(bucket) as Task[],
    }))
  }, [tasks])

  return (
    <div className="max-w-[900px] space-y-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold sm:text-2xl">Tasks</h1>
          <p className="mt-0.5 text-sm text-muted">
            {stats
              ? stats.pending === 0
                ? 'All clear — nothing pending.'
                : `${stats.pending} pending${stats.overdue > 0 ? ` · ${stats.overdue} overdue` : ''}`
              : 'Your to-do list, kept separate from your money.'}
          </p>
        </div>
        <TaskFormDialog
          trigger={
            <Button size="sm" className="shrink-0 self-start" aria-label="Add task">
              <Plus className="h-4 w-4" />
              Add task
            </Button>
          }
        />
      </div>

      <TaskSummary
        stats={stats}
        isLoading={statsLoading}
        activeStat={activeStat}
        onSelectStat={handleSelectStat}
      />

      <Card className="p-4 sm:p-5">
        <QuickAdd />
      </Card>

      <TaskFilterBar
        status={status}
        onStatusChange={setStatus}
        priority={priority}
        onPriorityChange={setPriority}
        datePreset={datePreset}
        onDatePresetChange={setDatePreset}
        customFrom={customFrom}
        onCustomFromChange={setCustomFrom}
        customTo={customTo}
        onCustomToChange={setCustomTo}
        search={search}
        onSearchChange={setSearch}
        hasActiveFilters={hasActiveFilters}
        onClear={handleClear}
      />

      {isLoading && (
        <Card>
          <CardContent className="space-y-3 pt-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12" />
            ))}
          </CardContent>
        </Card>
      )}

      {isError && (
        <Card>
          <EmptyState
            icon={AlertTriangle}
            title="Couldn't load your tasks"
            description="Check your Supabase connection and refresh."
          />
        </Card>
      )}

      {!isLoading && !isError && groups.length === 0 && (
        <Card>
          <EmptyState
            icon={ListTodo}
            title={hasActiveFilters ? 'No tasks match these filters' : 'Nothing on your list'}
            description={
              hasActiveFilters
                ? 'Try a different status, priority, or date range.'
                : 'Add your first task above — tick it off when it’s done.'
            }
            actionLabel={hasActiveFilters ? 'Clear filters' : undefined}
            onAction={hasActiveFilters ? handleClear : undefined}
          />
        </Card>
      )}

      {!isLoading && !isError && groups.length > 0 && (
        <div className="space-y-4">
          {groups.map((group) => (
            <Card key={group.bucket} className="overflow-hidden">
              <div className="flex items-center justify-between gap-3 border-b border-hairline px-5 py-3">
                <h2 className="flex items-center gap-2 font-display text-sm font-medium">
                  {group.bucket === 'overdue' && (
                    <AlertTriangle className="h-3.5 w-3.5 text-[var(--color-negative-600)]" />
                  )}
                  <span
                    className={
                      group.bucket === 'overdue' ? 'text-[var(--color-negative-600)]' : undefined
                    }
                  >
                    {DUE_BUCKET_LABEL[group.bucket]}
                  </span>
                </h2>
                <span className="num rounded-full surface-2 px-2 py-0.5 text-[11px] font-medium text-muted">
                  {group.items.length}
                </span>
              </div>
              <div className="divide-y divide-[var(--color-border-light)] px-5 py-1 dark:divide-[var(--color-border-dark)]">
                {group.items.map((task) => (
                  <TaskRow key={task.id} task={task} />
                ))}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
