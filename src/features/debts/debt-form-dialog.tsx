import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCreateDebt } from '@/features/debts/hooks'

const schema = z.object({
  direction: z.enum(['borrowed', 'lent']),
  counterparty_name: z.string().min(1, 'Enter a name'),
  principal_amount: z.coerce.number().positive('Amount must be greater than 0'),
  due_date: z.string().optional(),
  notes: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function DebtFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const createDebt = useCreateDebt()
  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { direction: 'lent' },
  })

  const onSubmit = async (values: FormValues) => {
    await createDebt.mutateAsync({ ...values, due_date: values.due_date || null })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add debt">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="direction"
            render={({ field }) => (
              <div className="grid grid-cols-2 gap-1.5 surface-2 rounded-lg p-1">
                {(['lent', 'borrowed'] as const).map((dir) => (
                  <button
                    type="button"
                    key={dir}
                    onClick={() => field.onChange(dir)}
                    className={cn(
                      'rounded-md py-1.5 text-sm font-medium capitalize transition-colors',
                      field.value === dir ? 'surface shadow-sm' : 'text-muted',
                    )}
                  >
                    {dir === 'lent' ? 'I lent money' : 'I borrowed money'}
                  </button>
                ))}
              </div>
            )}
          />

          <div>
            <Label htmlFor="counterparty_name">Person / entity</Label>
            <Input id="counterparty_name" placeholder="e.g. Rohan" {...register('counterparty_name')} />
            <FormError message={errors.counterparty_name?.message} />
          </div>

          <div>
            <Label htmlFor="principal_amount">Amount</Label>
            <Input id="principal_amount" type="number" step="0.01" {...register('principal_amount')} />
            <FormError message={errors.principal_amount?.message} />
          </div>

          <div>
            <Label htmlFor="due_date">Due date (optional)</Label>
            <Input id="due_date" type="date" {...register('due_date')} />
          </div>

          <div>
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input id="notes" {...register('notes')} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add debt
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
