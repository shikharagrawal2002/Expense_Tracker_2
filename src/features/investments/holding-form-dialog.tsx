import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  useCreateHolding,
  useUpdateHolding,
  INVESTMENT_TYPE_META,
  INVESTMENT_TYPES,
} from '@/features/investments/hooks'
import type { Holding } from '@/features/investments/api'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  type: z.enum(['mutual_fund', 'stock', 'crypto', 'gold', 'fd', 'ppf', 'nps', 'epf', 'bond', 'other']),
  invested_amount: z.coerce.number().nonnegative(),
  current_value: z.coerce.number().nonnegative(),
  purchased_at: z.string().min(1, 'Purchase date is required'),
  units: z.coerce.number().nonnegative().optional(),
  average_cost: z.coerce.number().nonnegative().optional(),
})
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

interface HoldingFormDialogProps {
  trigger: React.ReactNode
  /** Pass a holding to edit it in place; omit to create a new one. */
  holding?: Holding
}

export function HoldingFormDialog({ trigger, holding }: HoldingFormDialogProps) {
  const [open, setOpen] = useState(false)
  const createHolding = useCreateHolding()
  const updateHolding = useUpdateHolding()
  const isEdit = Boolean(holding)
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { type: 'mutual_fund', purchased_at: todayIso(), units: 0, average_cost: 0 },
  })

  /** Seed the form from the holding each time the dialog opens, so an edited
   *  then cancelled dialog doesn't leak stale values into the next open. */
  const handleOpenChange = (next: boolean) => {
    if (next) {
            reset(
        holding
          ? {
              name: holding.name,
              type: holding.type,
              invested_amount: holding.invested_amount,
              current_value: holding.current_value,
              purchased_at: holding.purchased_at ? holding.purchased_at.slice(0, 10) : todayIso(),
              units: holding.units ?? 0,
              average_cost: holding.average_cost ?? 0,
            }
          : { name: '', type: 'mutual_fund', invested_amount: 0, current_value: 0, purchased_at: todayIso(), units: 0, average_cost: 0 },
      )
    }
    setOpen(next)
  }

  const onSubmit = async (values: FormValues) => {
    if (holding) {
      await updateHolding.mutateAsync({ id: holding.id, ...values })
    } else {
      await createHolding.mutateAsync(values)
    }
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title={isEdit ? 'Edit holding' : 'Add holding'}
        description="Track manually - update the current value periodically."
      >
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

          <div>
            <Label htmlFor="purchased_at">Purchase date</Label>
            <Input id="purchased_at" type="date" {...register('purchased_at')} />
            <FormError message={errors.purchased_at?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="units">Units (optional)</Label>
              <Input id="units" type="number" step="0.0001" {...register('units')} />
            </div>
            <div>
              <Label htmlFor="average_cost">Avg cost (optional)</Label>
              <Input id="average_cost" type="number" step="0.01" {...register('average_cost')} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            {isEdit ? 'Save changes' : 'Add holding'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
