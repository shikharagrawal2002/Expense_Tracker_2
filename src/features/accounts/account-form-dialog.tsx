import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { useCreateAccount } from '@/features/accounts/hooks'
import { ACCOUNT_TYPE_META, ACCOUNT_TYPES } from '@/features/accounts/account-meta'
import { cn } from '@/lib/utils'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['bank', 'cash', 'credit_card', 'wallet', 'investment', 'loan']),
  currency: z.string().min(1),
  opening_balance: z.coerce.number(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function AccountFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const createAccount = useCreateAccount()
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'bank', currency: 'INR', opening_balance: 0 },
  })

  const selectedType = watch('type')

  const onSubmit = async (values: FormValues) => {
    await createAccount.mutateAsync({
      ...values,
      color: ACCOUNT_TYPE_META[values.type].color,
    })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add account" description="Track a bank, card, cash, or investment balance.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label>Account type</Label>
            <Controller
              control={control}
              name="type"
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {ACCOUNT_TYPES.map((type) => {
                    const meta = ACCOUNT_TYPE_META[type]
                    const Icon = meta.icon
                    const active = field.value === type
                    return (
                      <button
                        type="button"
                        key={type}
                        onClick={() => field.onChange(type)}
                        className={cn(
                          'flex flex-col items-center gap-1.5 rounded-xl border p-3 text-xs font-medium transition-colors',
                          active
                            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/15'
                            : 'border-hairline hover:surface-2',
                        )}
                      >
                        <Icon className="h-4 w-4" style={{ color: meta.color }} />
                        {meta.label}
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>

          <div>
            <Label htmlFor="name">Account name</Label>
            <Input
              id="name"
              placeholder={selectedType === 'credit_card' ? 'HDFC Regalia' : 'HDFC Savings'}
              {...register('name')}
            />
            <FormError message={errors.name?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="opening_balance">Opening balance</Label>
              <Input id="opening_balance" type="number" step="0.01" {...register('opening_balance')} />
              <FormError message={errors.opening_balance?.message} />
            </div>
            <div>
              <Label htmlFor="currency">Currency</Label>
              <Input id="currency" {...register('currency')} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add account
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
