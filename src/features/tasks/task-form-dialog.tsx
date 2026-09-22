import { useEffect, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, Flag } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Textarea, Label, FormError } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCreateTask, useUpdateTask } from '@/features/tasks/hooks'
import { addDays, formatFullDate, todayKey, toDateKey } from '@/features/tasks/task-dates'
import type { Task, TaskPriority } from '@/lib/supabase/types'

const schema = z.object({
  title: z.string().trim().min(1, 'Give the task a name').max(200, 'Keep it under 200 characters'),
  notes: z.string().optional(),
  due_date: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high']),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

const PRIORITY_OPTIONS: Array<{ value: TaskPriority; label: string; dot: string; active: string }> = [
  {
    value: 'low',
    label: 'Low',
    dot: 'bg-[var(--color-border-dark)]',
    active: 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/15',
  },
  {
    value: 'medium',
    label: 'Medium',
    dot: 'bg-[var(--color-warning-500)]',
    active: 'border-[var(--color-warning-500)] bg-[var(--color-warning-500)]/10',
  },
  {
    value: 'high',
    label: 'High',
    dot: 'bg-[var(--color-negative-600)]',
    active: 'border-[var(--color-negative-600)] bg-[var(--color-negative-500)]/10',
  },
]

interface TaskFormDialogProps {
  trigger: React.ReactNode
  /** Present in edit mode — the dialog then patches this task instead of inserting. */
  task?: Task
}

/** Add / edit dialog for a task. The same form serves both modes so a task can
 *  be created from the header button or the quick-add row, and edited from the
 *  pencil button on any row, without a second component. */
export function TaskFormDialog({ trigger, task }: TaskFormDialogProps) {
  const [open, setOpen] = useState(false)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const isEdit = Boolean(task)

  const {
    register,
    handleSubmit,
    control,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { priority: 'medium' },
  })

  // The dialog content unmounts on close but this component doesn't, so seed the
  // form every time it opens — otherwise the previous task's values linger.
  useEffect(() => {
    if (!open) return
    reset({
      title: task?.title ?? '',
      notes: task?.notes ?? '',
      due_date: task?.due_date ?? '',
      priority: task?.priority ?? 'medium',
    })
  }, [open, task, reset])

  const dueDate = watch('due_date') ?? ''

  const onSubmit = async (values: FormValues) => {
    const payload = {
      title: values.title.trim(),
      notes: values.notes?.trim() || null,
      due_date: values.due_date || null,
      priority: values.priority,
    }
    if (task) {
      await updateTask.mutateAsync({ id: task.id, ...payload })
    } else {
      await createTask.mutateAsync(payload)
    }
    setOpen(false)
  }

  const quickDates = [
    { label: 'Today', value: todayKey() },
    { label: 'Tomorrow', value: toDateKey(addDays(new Date(), 1)) },
    { label: 'In a week', value: toDateKey(addDays(new Date(), 7)) },
  ]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={isEdit ? 'Edit task' : 'New task'}
        description={isEdit ? undefined : 'Add it to your list now — you can set a due date later.'}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="title">Task</Label>
            <Input id="title" autoFocus placeholder="e.g. Pay the credit card bill" {...register('title')} />
            <FormError message={errors.title?.message} />
          </div>

          <div>
            <Label>Priority</Label>
            <Controller
              control={control}
              name="priority"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-1.5">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => field.onChange(opt.value)}
                      aria-pressed={field.value === opt.value}
                      className={cn(
                        'flex items-center justify-center gap-2 rounded-lg border py-2 text-xs font-medium transition-colors',
                        field.value === opt.value ? opt.active : 'border-hairline hover:surface-2',
                      )}
                    >
                      <span className={cn('h-2 w-2 rounded-full', opt.dot)} />
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            />
          </div>

          <div>
            <Label htmlFor="due_date">Due date</Label>
            <Input id="due_date" type="date" {...register('due_date')} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {quickDates.map((quick) => (
                <button
                  key={quick.label}
                  type="button"
                  onClick={() => setValue('due_date', quick.value, { shouldDirty: true })}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-xs font-medium transition-colors',
                    dueDate === quick.value
                      ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-500)]/15 dark:text-[var(--color-brand-300)]'
                      : 'border-hairline text-muted hover:surface-2 hover:text-inherit',
                  )}
                >
                  {quick.label}
                </button>
              ))}
              {dueDate && (
                <button
                  type="button"
                  onClick={() => setValue('due_date', '', { shouldDirty: true })}
                  className="rounded-full border border-hairline px-2.5 py-1 text-xs font-medium text-muted transition-colors hover:surface-2 hover:text-inherit"
                >
                  Clear
                </button>
              )}
            </div>
            {dueDate && (
              <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
                <Flag className="h-3 w-3" />
                {formatFullDate(dueDate)}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Textarea
              id="notes"
              rows={3}
              placeholder="Anything you'll want to remember when you pick this up"
              {...register('notes')}
            />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add task'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
