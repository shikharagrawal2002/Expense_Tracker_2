import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useAccounts } from '@/features/accounts/hooks'
import { useCreateRecurringRule } from '@/features/recurring/hooks'

const schema = z.object({
  label: z.string().min(1, 'Name is required'),
  account_id: z.string().min(1, 'Select an account'),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly']),
  next_due_date: z.string().min(1),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function RecurringFormDialog({
  trigger,
  kind,
}: {
  trigger: React.ReactNode
  kind: 'subscription' | 'bill'
}) {
  const [open, setOpen] = useState(false)
  const { data: accounts } = useAccounts()
  const createRule = useCreateRecurringRule(kind)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { frequency: 'monthly' },
  })

  const onSubmit = async (values: FormValues) => {
    await createRule.mutateAsync({
      ...values,
      is_subscription: kind === 'subscription',
      is_bill: kind === 'bill',
      type: 'expense',
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={kind === 'subscription' ? 'Add subscription' : 'Add bill'}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="label">{kind === 'subscription' ? 'Service name' : 'Bill name'}</Label>
            <Input id="label" placeholder={kind === 'subscription' ? 'Netflix' : 'Electricity'} {...register('label')} />
            <FormError message={errors.label?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="amount">Amount</Label>
              <Input id="amount" type="number" step="0.01" {...register('amount')} />
              <FormError message={errors.amount?.message} />
            </div>
            <div>
              <Label htmlFor="frequency">Frequency</Label>
              <Select id="frequency" {...register('frequency')}>
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="quarterly">Quarterly</option>
                <option value="yearly">Yearly</option>
                <option value="daily">Daily</option>
              </Select>
            </div>
          </div>

          <div>
            <Label htmlFor="account_id">Pay from</Label>
            <Select id="account_id" {...register('account_id')}>
              <option value="">Select account…</option>
              {accounts?.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </Select>
            <FormError message={errors.account_id?.message} />
          </div>

          <div>
            <Label htmlFor="next_due_date">Next due date</Label>
            <Input id="next_due_date" type="date" {...register('next_due_date')} />
            <FormError message={errors.next_due_date?.message} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {kind === 'subscription' ? 'Add subscription' : 'Add bill'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
