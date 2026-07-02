import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCreateGoal } from '@/features/goals/hooks'
import { COLOR_SWATCHES } from '@/features/categories/category-meta'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  goal_type: z.enum(['savings', 'emergency_fund', 'debt_payoff', 'custom']),
  target_amount: z.coerce.number().positive('Enter a target greater than 0'),
  target_date: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

const TYPE_OPTIONS = [
  { value: 'savings', label: 'Savings' },
  { value: 'emergency_fund', label: 'Emergency Fund' },
  { value: 'debt_payoff', label: 'Debt Payoff' },
  { value: 'custom', label: 'Custom' },
] as const

export function GoalFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const createGoal = useCreateGoal()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { goal_type: 'savings' },
  })

  const onSubmit = async (values: FormValues) => {
    await createGoal.mutateAsync({
      ...values,
      target_date: values.target_date || null,
      color: COLOR_SWATCHES[Math.floor(Math.random() * COLOR_SWATCHES.length)],
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Create a goal">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="goal_type"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-1.5">
                {TYPE_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      'rounded-lg border py-2 text-xs font-medium transition-colors',
                      field.value === opt.value
                        ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/15'
                        : 'border-hairline hover:surface-2',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />

          <div>
            <Label htmlFor="name">Goal name</Label>
            <Input id="name" placeholder="e.g. New laptop" {...register('name')} />
            <FormError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="target_amount">Target amount</Label>
            <Input id="target_amount" type="number" step="0.01" placeholder="100000" {...register('target_amount')} />
            <FormError message={errors.target_amount?.message} />
          </div>

          <div>
            <Label htmlFor="target_date">Target date (optional)</Label>
            <Input id="target_date" type="date" {...register('target_date')} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Create goal
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
