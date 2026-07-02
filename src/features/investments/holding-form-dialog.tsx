import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useCreateHolding, INVESTMENT_TYPE_META, INVESTMENT_TYPES } from '@/features/investments/hooks'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['mutual_fund', 'stock', 'crypto', 'gold', 'fd', 'ppf', 'nps', 'epf', 'bond', 'other']),
  invested_amount: z.coerce.number().nonnegative(),
  current_value: z.coerce.number().nonnegative(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function HoldingFormDialog({ trigger }: { trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const createHolding = useCreateHolding()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'mutual_fund' },
  })

  const onSubmit = async (values: FormValues) => {
    await createHolding.mutateAsync(values)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add holding" description="Track manually — update the current value periodically.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Parag Parikh Flexi Cap" {...register('name')} />
            <FormError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor="type">Type</Label>
            <Select id="type" {...register('type')}>
              {INVESTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INVESTMENT_TYPE_META[t].label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="invested_amount">Invested amount</Label>
              <Input id="invested_amount" type="number" step="0.01" {...register('invested_amount')} />
              <FormError message={errors.invested_amount?.message} />
            </div>
            <div>
              <Label htmlFor="current_value">Current value</Label>
              <Input id="current_value" type="number" step="0.01" {...register('current_value')} />
              <FormError message={errors.current_value?.message} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add holding
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
