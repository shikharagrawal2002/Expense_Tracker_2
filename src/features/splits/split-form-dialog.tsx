import { useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, Loader2, Scale } from 'lucide-react'
import { Dialog, DialogTrigger, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { useTransactions } from '@/features/transactions/hooks'
import { useCreateSplitGroup } from '@/features/splits/hooks'
import type { Transaction } from '@/lib/supabase/types'

interface ParticipantRow {
  key: string
  name: string
  shareAmount: string
}

function emptyParticipant(): ParticipantRow {
  return { key: crypto.randomUUID(), name: '', shareAmount: '' }
}

interface SplitFormDialogProps {
  trigger: React.ReactNode
  /** When provided (e.g. launched from the "Add to split" button on a
   *  transaction row), the transaction is locked in and the picker is
   *  replaced with a read-only summary instead of a dropdown. */
  presetTransaction?: Transaction
}

export function SplitFormDialog({ trigger, presetTransaction }: SplitFormDialogProps) {
  const [open, setOpen] = useState(false)
  const [transactionId, setTransactionId] = useState('')
  const [title, setTitle] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [participants, setParticipants] = useState<ParticipantRow[]>([emptyParticipant(), emptyParticipant()])
  const [error, setError] = useState<string | null>(null)

  // Only need the full expense list when there's no preset transaction to lock in.
  const { data: transactions } = useTransactions({ type: 'expense' })
  const createSplitGroup = useCreateSplitGroup()

  const selectedTransaction = presetTransaction ?? transactions?.find((t) => t.id === transactionId)

  // Pre-fill title/amount from the picked transaction, without stomping on
  // manual edits if the person already typed something.
  useEffect(() => {
    if (!selectedTransaction) return
    setTitle((prev) => prev || selectedTransaction.notes || 'Split expense')
    setTotalAmount((prev) => prev || String(selectedTransaction.amount))
  }, [selectedTransaction])

  useEffect(() => {
    if (!open) {
      setTransactionId('')
      setTitle('')
      setTotalAmount('')
      setParticipants([emptyParticipant(), emptyParticipant()])
      setError(null)
    } else if (presetTransaction) {
      setTransactionId(presetTransaction.id)
    }
  }, [open, presetTransaction])

  const totalShares = useMemo(
    () => participants.reduce((sum, p) => sum + (Number(p.shareAmount) || 0), 0),
    [participants],
  )
  const remaining = (Number(totalAmount) || 0) - totalShares

  function updateParticipant(key: string, patch: Partial<ParticipantRow>) {
    setParticipants((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function addParticipant() {
    setParticipants((prev) => [...prev, emptyParticipant()])
  }

  function removeParticipant(key: string) {
    setParticipants((prev) => (prev.length > 1 ? prev.filter((p) => p.key !== key) : prev))
  }

  function splitEqually() {
    const total = Number(totalAmount) || 0
    const named = participants.filter((p) => p.name.trim())
    const count = named.length || participants.length
    if (count === 0 || total === 0) return
    const base = Math.floor((total / count) * 100) / 100
    const remainder = Math.round((total - base * count) * 100) / 100
    setParticipants((prev) =>
      prev.map((p, i) => ({
        ...p,
        shareAmount: String(i === prev.length - 1 ? Math.round((base + remainder) * 100) / 100 : base),
      })),
    )
  }

  async function handleSubmit() {
    setError(null)
    const validParticipants = participants.filter((p) => p.name.trim() && Number(p.shareAmount) > 0)
    if (!title.trim()) return setError('Give this split a title.')
    if (!totalAmount || Number(totalAmount) <= 0) return setError('Enter the total bill amount.')
    if (validParticipants.length === 0) return setError('Add at least one participant with a share amount.')

    await createSplitGroup.mutateAsync({
      title: title.trim(),
      total_amount: Number(totalAmount),
      transaction_id: transactionId || undefined,
      participants: validParticipants.map((p) => ({ name: p.name.trim(), share_amount: Number(p.shareAmount) })),
    })
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent title="Split an expense">
        <div className="space-y-4">
          <div>
            <Label>Transaction</Label>
            {presetTransaction ? (
              <div className="rounded-lg border border-hairline surface-2 px-3 py-2 text-sm">
                {new Date(presetTransaction.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                {' · '}
                {presetTransaction.notes || 'Uncategorized'}
                {' · '}
                {formatCurrency(presetTransaction.amount, presetTransaction.currency)}
              </div>
            ) : (
              <Select id="split-transaction" value={transactionId} onChange={(e) => setTransactionId(e.target.value)}>
                <option value="">Select the expense to split…</option>
                {transactions?.map((t) => (
                  <option key={t.id} value={t.id}>
                    {new Date(t.occurred_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} ·{' '}
                    {t.notes || 'Uncategorized'} · {formatCurrency(t.amount, t.currency)}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <div>
            <Label htmlFor="split-title">Title</Label>
            <Input id="split-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Goa trip dinner" />
          </div>

          <div>
            <Label htmlFor="split-total">Total bill amount</Label>
            <Input
              id="split-total"
              type="number"
              step="0.01"
              value={totalAmount}
              onChange={(e) => setTotalAmount(e.target.value)}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Participants</Label>
              <Button type="button" size="sm" variant="ghost" onClick={splitEqually}>
                <Scale className="h-3.5 w-3.5" />
                Split equally
              </Button>
            </div>
            <div className="space-y-2">
              {participants.map((p) => (
                <div key={p.key} className="flex gap-2">
                  <Input
                    placeholder="Name"
                    value={p.name}
                    onChange={(e) => updateParticipant(p.key, { name: e.target.value })}
                    className="flex-1"
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Share"
                    value={p.shareAmount}
                    onChange={(e) => updateParticipant(p.key, { shareAmount: e.target.value })}
                    className="w-28"
                  />
                  <button
                    type="button"
                    onClick={() => removeParticipant(p.key)}
                    className="rounded-lg p-2 text-muted hover:bg-[var(--color-negative-500)]/10 hover:text-[var(--color-negative-600)] transition-colors shrink-0"
                    aria-label="Remove participant"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={addParticipant}
              className="mt-2 flex items-center gap-1 text-sm text-[var(--color-brand-500)] hover:underline"
            >
              <Plus className="h-3.5 w-3.5" />
              Add participant
            </button>
            {Number(totalAmount) > 0 && (
              <p className="mt-2 text-xs text-muted">
                {remaining === 0
                  ? 'Shares add up to the full amount.'
                  : remaining > 0
                    ? `${formatCurrency(remaining)} of the bill isn't assigned to anyone yet (e.g. your own share).`
                    : `Shares are ${formatCurrency(Math.abs(remaining))} more than the total bill — double check the amounts.`}
              </p>
            )}
          </div>

          <FormError message={error ?? undefined} />

          <Button type="button" className="w-full" onClick={handleSubmit} disabled={createSplitGroup.isPending}>
            {createSplitGroup.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Create split
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
