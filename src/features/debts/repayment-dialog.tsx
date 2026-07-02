import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { useRecordRepayment } from '@/features/debts/hooks'
import type { Debt } from '@/features/debts/api'

const schema = z.object({ amount: z.coerce.number().positive('Enter an amount greater than 0') })
type FormInput = z.input<typeof schema>
type FormValues = z.output<typeof schema>

export function RepaymentDialog({ debt, trigger }: { debt: Debt; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const recordRepayment = useRecordRepayment()
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(schema) })

  const onSubmit = async (values: FormValues) => {
    await recordRepayment.mutateAsync({ debt, amount: values.amount })
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title={`Record repayment — ${debt.counterparty_name}`}>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" step="0.01" autoFocus {...register('amount')} />
            <FormError message={errors.amount?.message} />
          </div>
          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Record repayment
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
