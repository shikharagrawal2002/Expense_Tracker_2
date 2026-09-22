import { useState } from 'react'
import { Check, Pencil, Trash2, CalendarDays, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useDeleteTask, useToggleTask } from '@/features/tasks/hooks'
import { TaskFormDialog } from '@/features/tasks/task-form-dialog'
import { isDueToday, isOverdue, formatDueDate, formatFullDate } from '@/features/tasks/task-dates'
import type { Task, TaskPriority } from '@/lib/supabase/types'

const PRIORITY_META: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  low: { label: 'Low priority', dot: 'bg-[var(--color-border-dark)]', text: 'text-muted' },
  medium: {
    label: 'Medium priority',
    dot: 'bg-[var(--color-warning-500)]',
    text: 'text-[var(--color-warning-500)]',
  },
  high: {
    label: 'High priority',
    dot: 'bg-[var(--color-negative-600)]',
    text: 'text-[var(--color-negative-600)]',
  },
}

/** Shared styling for the icon-only row actions, matching TransactionRow. */
const actionButtonClass =
  'flex h-8 w-8 items-center justify-center rounded-lg text-muted hover:text-inherit hover:surface transition-colors'

/** A single task: the tick, the content, and the row actions. */
export function TaskRow({ task }: { task: Task }) {
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()
  const [expanded, setExpanded] = useState(false)

  const isDone = task.is_done
  const overdue = isOverdue(task.due_date, isDone)
  const dueToday = isDueToday(task.due_date, isDone)
  const priority = PRIORITY_META[task.priority] ?? PRIORITY_META.medium

  const editButton = (
    <TaskFormDialog
      task={task}
      trigger={
        <button className={actionButtonClass} aria-label={`Edit ${task.title}`} title="Edit task">
          <Pencil className="h-4 w-4" />
        </button>
      }
    />
  )

  const deleteButton = (
    <button
      onClick={() => deleteTask.mutate(task.id)}
      disabled={deleteTask.isPending}
      className={cn(
        actionButtonClass,
        'hover:bg-[var(--color-negative-500)]/10 hover:text-[var(--color-negative-600)]',
      )}
      aria-label={`Delete ${task.title}`}
      title="Delete task"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  )

  return (
    <div className="group">
      <div className="flex items-start gap-3 px-2 py-3 -mx-2 transition-colors hover:surface-2 rounded-lg">
        {/* Tick — a round toggle that reads as "done" at a glance. */}
        <button
          type="button"
          onClick={() => toggleTask.mutate({ id: task.id, isDone: !isDone })}
          aria-pressed={isDone}
          aria-label={isDone ? `Mark ${task.title} as pending` : `Mark ${task.title} as done`}
          className={cn(
            'mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-all',
            isDone
              ? 'border-[var(--color-positive-500)] bg-[var(--color-positive-500)] text-white'
              : 'border-[var(--color-border-dark)] text-transparent hover:border-[var(--color-positive-500)] hover:text-[var(--color-positive-500)]/50',
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>

        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'text-sm font-medium break-words transition-colors',
              isDone && 'text-muted line-through decoration-1',
            )}
          >
            {task.title}
          </p>

          {/* Meta line: due chip + priority pip. */}
          <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
            {task.due_date && (
              <span
                title={formatFullDate(task.due_date)}
                className={cn(
                  'inline-flex items-center gap-1 font-medium',
                  isDone
                    ? 'text-muted'
                    : overdue
                      ? 'text-[var(--color-negative-600)]'
                      : dueToday
                        ? 'text-[var(--color-warning-500)]'
                        : 'text-muted',
                )}
              >
                <CalendarDays className="h-3 w-3 shrink-0" />
                {isDone ? formatFullDate(task.due_date) : formatDueDate(task.due_date)}
              </span>
            )}

            {task.priority !== 'low' && (
              <span className={cn('inline-flex items-center gap-1', isDone ? 'text-muted' : priority.text)}>
                <span
                  className={cn(
                    'h-1.5 w-1.5 rounded-full',
                    isDone ? 'bg-[var(--color-border-dark)]' : priority.dot,
                  )}
                />
                {task.priority === 'high' ? 'High' : 'Medium'}
              </span>
            )}

            {task.notes && (
              <span className="hidden min-w-0 max-w-full truncate text-muted sm:inline">{task.notes}</span>
            )}
          </div>

          {/* On phones the note gets its own line — the meta row is too tight. */}
          {task.notes && <p className="mt-1 text-xs text-muted truncate sm:hidden">{task.notes}</p>}
        </div>

        {isDone && (
          <span className="mt-0.5 hidden shrink-0 items-center gap-1 rounded-full bg-[var(--color-positive-500)]/15 px-2 py-0.5 text-[11px] font-medium text-[var(--color-positive-600)] sm:inline-flex">
            Done
          </span>
        )}

        <div className="hidden shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 sm:flex">
          {editButton}
          {deleteButton}
        </div>

        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-inherit hover:surface sm:hidden"
          aria-expanded={expanded}
          aria-label={expanded ? 'Hide task actions' : 'Show task actions'}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', expanded && 'rotate-180')} />
        </button>
      </div>

      {expanded && (
        <div className="flex items-center justify-end gap-1.5 border-t border-hairline px-2 py-1.5 animate-in slide-in-from-top-1 fade-in duration-200 sm:hidden">
          {editButton}
          {deleteButton}
        </div>
      )}

      {/* Keeps a failed tick from silently looking saved. */}
      {toggleTask.isError && toggleTask.variables?.id === task.id && (
        <p className="px-2 pb-2 text-xs text-[var(--color-negative-600)]">
          Couldn't update this task — check your connection.
        </p>
      )}
    </div>
  )
}
