import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useAccounts } from '@/features/accounts/hooks'
import { useCategories } from '@/features/categories/hooks'
import { useCreateTransaction } from '@/features/transactions/hooks'

const schema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  account_id: z.string().min(1, 'Select an account'),
  category_id: z.string().optional(),
  amount: z.coerce.number().positive('Amount must be greater than 0'),
  occurred_at: z.string().min(1),
  notes: z.string().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

const TYPE_TABS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
] as const

export function TransactionFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createTransaction = useCreateTransaction()

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      type: 'expense',
      occurred_at: new Date().toISOString().slice(0, 16),
    },
  })

  const type = watch('type')
  const relevantCategories = categories?.filter((c) => c.kind === type)

  const onSubmit = async (values: FormValues) => {
    await createTransaction.mutateAsync({
      ...values,
      category_id: values.category_id || undefined,
      occurred_at: new Date(values.occurred_at).toISOString(),
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add transaction">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="type"
            render={({ field }) => (
              <div className="grid grid-cols-3 gap-1.5 surface-2 rounded-lg p-1">
                {TYPE_TABS.map((tab) => (
                  <button
                    type="button"
                    key={tab.value}
                    onClick={() => field.onChange(tab.value)}
                    className={cn(
                      'rounded-md py-1.5 text-sm font-medium transition-colors',
                      field.value === tab.value ? 'surface shadow-sm' : 'text-muted',
                    )}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            )}
          />

          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register('amount')} />
            <FormError message={errors.amount?.message} />
          </div>

          <div>
            <Label htmlFor="account_id">Account</Label>
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

          {type !== 'transfer' && (
            <div>
              <Label htmlFor="category_id">Category</Label>
              <Select id="category_id" {...register('category_id')}>
                <option value="">Uncategorized</option>
                {relevantCategories?.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="occurred_at">Date</Label>
            <Input id="occurred_at" type="datetime-local" {...register('occurred_at')} />
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Input id="notes" placeholder="Optional" {...register('notes')} />
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add transaction
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
