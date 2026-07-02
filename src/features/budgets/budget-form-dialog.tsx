import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useCategories } from '@/features/categories/hooks'
import { useCreateBudget } from '@/features/budgets/hooks'

const schema = z.object({
  category_id: z.string().min(1, 'Select a category'),
  amount_limit: z.coerce.number().positive('Enter a limit greater than 0'),
  alert_threshold_pct: z.coerce.number().min(1).max(100),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function BudgetFormDialog({ trigger, periodMonth }: { trigger: React.ReactNode; periodMonth: string }) {
  const [open, setOpen] = useState(false)
  const { data: categories } = useCategories()
  const createBudget = useCreateBudget()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { alert_threshold_pct: 80 },
  })

  const expenseCategories = categories?.filter((c) => c.kind === 'expense')

  const onSubmit = async (values: FormValues) => {
    await createBudget.mutateAsync({ ...values, period_month: periodMonth })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Set a budget" description="Cap monthly spend for a category and get alerted as you approach it.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="category_id">Category</Label>
            <Select id="category_id" {...register('category_id')}>
              <option value="">Select category…</option>
              {expenseCategories?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            <FormError message={errors.category_id?.message} />
          </div>

          <div>
            <Label htmlFor="amount_limit">Monthly limit</Label>
            <Input id="amount_limit" type="number" step="0.01" placeholder="10000" {...register('amount_limit')} />
            <FormError message={errors.amount_limit?.message} />
          </div>

          <div>
            <Label htmlFor="alert_threshold_pct">Alert me at (%)</Label>
            <Input id="alert_threshold_pct" type="number" min={1} max={100} {...register('alert_threshold_pct')} />
            <FormError message={errors.alert_threshold_pct?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Set budget
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
