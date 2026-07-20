import { useEffect, useState } from 'react'
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
import { useCreateTransaction, useEditTransaction } from '@/features/transactions/hooks'
import type { Transaction } from '@/lib/supabase/types'

const schema = z
  .object({
    type: z.enum(['income', 'expense', 'transfer']),
    account_id: z.string().min(1, 'Select an account'),
    transfer_account_id: z.string().optional(),
    category_id: z.string().optional(),
    amount: z.coerce.number().positive('Amount must be greater than 0'),
    occurred_at: z.string().min(1),
    notes: z.string().optional(),
  })
  .superRefine((values, ctx) => {
    if (values.type !== 'transfer') return
    if (!values.transfer_account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transfer_account_id'],
        message: 'Select the destination account',
      })
    } else if (values.transfer_account_id === values.account_id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['transfer_account_id'],
        message: 'Destination must be different from the source account',
      })
    }
  })
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

const TYPE_TABS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'transfer', label: 'Transfer' },
] as const

const emptyDefaults = (): FormInput => ({
  type: 'expense',
  account_id: '',
  transfer_account_id: '',
  category_id: '',
  amount: undefined as unknown as number,
  occurred_at: new Date().toISOString().slice(0, 16),
  notes: '',
})

const defaultsFromTransaction = (txn: Transaction): FormInput => ({
  type: txn.type,
  account_id: txn.account_id,
  transfer_account_id: txn.transfer_account_id ?? '',
  category_id: txn.category_id ?? '',
  amount: txn.amount,
  occurred_at: new Date(txn.occurred_at).toISOString().slice(0, 16),
  notes: txn.notes ?? '',
})

interface TransactionFormDialogProps {
  trigger: React.ReactNode
  /** When provided, the dialog edits this transaction instead of creating a new one. */
  transaction?: Transaction
}

export function TransactionFormDialog({ trigger, transaction }: TransactionFormDialogProps) {
  const [open, setOpen] = useState(false)
  const isEditing = !!transaction
  const { data: accounts } = useAccounts()
  const { data: categories } = useCategories()
  const createTransaction = useCreateTransaction()
  const editTransaction = useEditTransaction()

  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: emptyDefaults(),
  })

  // Re-populate the form whenever the dialog opens, either with the
  // transaction being edited or a blank slate for a new one.
  useEffect(() => {
    if (!open) return
    reset(transaction ? defaultsFromTransaction(transaction) : emptyDefaults())
  }, [open, transaction, reset])

  const type = watch('type')
  const sourceAccountId = watch('account_id')
  const relevantCategories = categories?.filter((c) => c.kind === type)

  const onSubmit = async (values: FormValues) => {
    const shared = {
      account_id: values.account_id,
      transfer_account_id: values.type === 'transfer' ? values.transfer_account_id : undefined,
      category_id: values.category_id || undefined,
      type: values.type,
      amount: values.amount,
      occurred_at: new Date(values.occurred_at).toISOString(),
      notes: values.notes || undefined,
    }

    if (isEditing && transaction) {
      await editTransaction.mutateAsync({ id: transaction.id, ...shared })
    } else {
      await createTransaction.mutateAsync(shared)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={isEditing ? 'Edit transaction' : 'Add transaction'}>
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
                    onClick={() => {
                      field.onChange(tab.value)
                      if (tab.value !== 'transfer') setValue('transfer_account_id', '')
                    }}
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
            <Label htmlFor="account_id">{type === 'transfer' ? 'From account' : 'Account'}</Label>
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

          {type === 'transfer' && (
            <div>
              <Label htmlFor="transfer_account_id">To account</Label>
              <Select id="transfer_account_id" {...register('transfer_account_id')}>
                <option value="">Select account…</option>
                {accounts
                  ?.filter((a) => a.id !== sourceAccountId)
                  .map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
              </Select>
              <FormError message={errors.transfer_account_id?.message} />
            </div>
          )}

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
            {isEditing ? 'Save changes' : 'Add transaction'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
