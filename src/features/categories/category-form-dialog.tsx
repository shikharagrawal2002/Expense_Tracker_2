import { useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useCreateCategory } from '@/features/categories/hooks'
import { getCategoryIcon, ICON_PICKER_OPTIONS, COLOR_SWATCHES } from '@/features/categories/category-meta'

const schema = z.object({
  name: z.string().min(1, 'Name is required'),
  kind: z.enum(['income', 'expense', 'transfer', 'investment']),
  icon: z.string().min(1),
  color: z.string().min(1),
})
type FormValues = z.infer<typeof schema>

const KIND_OPTIONS = [
  { value: 'expense', label: 'Expense' },
  { value: 'income', label: 'Income' },
  { value: 'investment', label: 'Investment' },
  { value: 'transfer', label: 'Transfer' },
] as const

export function CategoryFormDialog({ trigger, defaultKind = 'expense' }: { trigger: React.ReactNode; defaultKind?: FormValues['kind'] }) {
  const [open, setOpen] = useState(false)
  const createCategory = useCreateCategory()
  const {
    register,
    handleSubmit,
    control,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { kind: defaultKind, icon: 'tag', color: COLOR_SWATCHES[0] },
  })

  const color = watch('color')

  const onSubmit = async (values: FormValues) => {
    await createCategory.mutateAsync(values)
    reset()
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Add category">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <div className="grid grid-cols-4 gap-1.5 surface-2 rounded-lg p-1">
                {KIND_OPTIONS.map((opt) => (
                  <button
                    type="button"
                    key={opt.value}
                    onClick={() => field.onChange(opt.value)}
                    className={cn(
                      'rounded-md py-1.5 text-xs font-medium transition-colors',
                      field.value === opt.value ? 'surface shadow-sm' : 'text-muted',
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          />

          <div>
            <Label htmlFor="name">Category name</Label>
            <Input id="name" placeholder="e.g. Pet Care" {...register('name')} />
            <FormError message={errors.name?.message} />
          </div>

          <div>
            <Label>Icon</Label>
            <Controller
              control={control}
              name="icon"
              render={({ field }) => (
                <div className="grid grid-cols-8 gap-1.5">
                  {ICON_PICKER_OPTIONS.map((opt) => {
                    const Icon = getCategoryIcon(opt)
                    const active = field.value === opt
                    return (
                      <button
                        type="button"
                        key={opt}
                        onClick={() => field.onChange(opt)}
                        className={cn(
                          'flex h-8 w-8 items-center justify-center rounded-lg border transition-colors',
                          active
                            ? 'border-[var(--color-brand-500)] bg-[var(--color-brand-50)] dark:bg-[var(--color-brand-500)]/15'
                            : 'border-hairline hover:surface-2',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </button>
                    )
                  })}
                </div>
              )}
            />
          </div>

          <Controller
            control={control}
            name="color"
            render={({ field }) => (
              <div>
                <Label>Color</Label>
                <div className="flex gap-1.5">
                  {COLOR_SWATCHES.map((swatch) => (
                    <button
                      type="button"
                      key={swatch}
                      onClick={() => field.onChange(swatch)}
                      className={cn(
                        'h-7 w-7 rounded-full border-2 transition-transform',
                        color === swatch ? 'scale-110 border-[var(--color-text-light)] dark:border-[var(--color-text-dark)]' : 'border-transparent',
                      )}
                      style={{ backgroundColor: swatch }}
                    />
                  ))}
                </div>
              </div>
            )}
          />

          <Button type="submit" className="w-full" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            Add category
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
