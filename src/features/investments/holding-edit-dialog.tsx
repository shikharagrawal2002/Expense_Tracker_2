import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { useUpdateHolding, INVESTMENT_TYPE_META, INVESTMENT_TYPES } from '@/features/investments/hooks'
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

/** Edits an existing holding — the purchase date matters because it drives the
 *  long-term vs short-term tax classification and the CAGR annualisation. */
export function HoldingEditDialog({ holding, trigger }: { holding: Holding; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const updateHolding = useUpdateHolding()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: holding.name,
      type: holding.type,
      invested_amount: holding.invested_amount,
      current_value: holding.current_value,
      purchased_at: holding.purchased_at?.slice(0, 10) ?? todayIso(),
      units: holding.units ?? 0,
      average_cost: holding.average_cost ?? 0,
    },
  })

  const onSubmit = async (values: FormValues) => {
    await updateHolding.mutateAsync({ id: holding.id, ...values })
    setOpen(false)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (next) {
          reset({
            name: holding.name,
            type: holding.type,
            invested_amount: holding.invested_amount,
            current_value: holding.current_value,
            purchased_at: holding.purchased_at?.slice(0, 10) ?? todayIso(),
            units: holding.units ?? 0,
            average_cost: holding.average_cost ?? 0,
          })
        }
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Edit holding" description="Keep invested and current value up to date so returns stay accurate.">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor={`edit-name-${holding.id}`}>Name</Label>
            <Input id={`edit-name-${holding.id}`} {...register('name')} />
            <FormError message={errors.name?.message} />
          </div>

          <div>
            <Label htmlFor={`edit-type-${holding.id}`}>Type</Label>
            <Select id={`edit-type-${holding.id}`} {...register('type')}>
              {INVESTMENT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {INVESTMENT_TYPE_META[t].label}
                </option>
              ))}
            </Select>
            <FormError message={errors.type?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`edit-invested-${holding.id}`}>Invested</Label>
              <Input id={`edit-invested-${holding.id}`} type="number" step="0.01" {...register('invested_amount')} />
              <FormError message={errors.invested_amount?.message} />
            </div>
            <div>
              <Label htmlFor={`edit-current-${holding.id}`}>Current value</Label>
              <Input id={`edit-current-${holding.id}`} type="number" step="0.01" {...register('current_value')} />
              <FormError message={errors.current_value?.message} />
            </div>
          </div>

          <div>
            <Label htmlFor={`edit-purchased-${holding.id}`}>Purchase date</Label>
            <Input id={`edit-purchased-${holding.id}`} type="date" {...register('purchased_at')} />
            <FormError message={errors.purchased_at?.message} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor={`edit-units-${holding.id}`}>Units (optional)</Label>
              <Input id={`edit-units-${holding.id}`} type="number" step="0.0001" {...register('units')} />
            </div>
            <div>
              <Label htmlFor={`edit-avgcost-${holding.id}`}>Avg cost (optional)</Label>
              <Input id={`edit-avgcost-${holding.id}`} type="number" step="0.01" {...register('average_cost')} />
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Save changes
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}