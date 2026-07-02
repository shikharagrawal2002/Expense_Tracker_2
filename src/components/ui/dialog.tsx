import * as RadixDialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export const Dialog = RadixDialog.Root
export const DialogTrigger = RadixDialog.Trigger

export function DialogContent({
  className,
  children,
  title,
  description,
}: {
  className?: string
  children: React.ReactNode
  title: string
  description?: string
}) {
  return (
    <RadixDialog.Portal>
      <RadixDialog.Overlay className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 data-[state=open]:animate-in data-[state=open]:fade-in data-[state=closed]:animate-out data-[state=closed]:fade-out" />
      <RadixDialog.Content
        className={cn(
          'fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2',
          'surface border border-hairline rounded-2xl shadow-xl p-6',
          'data-[state=open]:animate-in data-[state=open]:fade-in data-[state=open]:zoom-in-95',
          'data-[state=closed]:animate-out data-[state=closed]:fade-out data-[state=closed]:zoom-out-95',
          'max-h-[90vh] overflow-y-auto',
          className,
        )}
      >
        <div className="flex items-start justify-between mb-4">
          <div>
            <RadixDialog.Title className="font-display text-lg font-semibold">{title}</RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="text-sm text-muted mt-0.5">
                {description}
              </RadixDialog.Description>
            )}
          </div>
          <RadixDialog.Close className="rounded-lg p-1.5 hover:surface-2 text-muted" aria-label="Close">
            <X className="h-4 w-4" />
          </RadixDialog.Close>
        </div>
        {children}
      </RadixDialog.Content>
    </RadixDialog.Portal>
  )
}
