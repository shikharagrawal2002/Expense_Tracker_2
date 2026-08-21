import { useState } from 'react'
import { Copy, Check, Mail, Plus, Trash2, Loader2, Inbox, ShieldCheck, X } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { Badge } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import {
  useEmailIngestAddresses,
  useCreateEmailIngestAddress,
  useSetEmailIngestActive,
  useDeleteEmailIngestAddress,
  useEmailIngestLogs,
} from '@/features/email/hooks'
import { fullInboundAddress } from '@/features/email/api'

const STATUS_STYLES: Record<string, string> = {
  imported: 'bg-[var(--color-positive-500)]/15 text-[var(--color-positive-600)]',
  parsed: 'bg-[var(--color-brand-500)]/15 text-[var(--color-brand-600)]',
  failed: 'bg-[var(--color-negative-500)]/15 text-[var(--color-negative-600)]',
  rejected: 'bg-[var(--color-warning-500)]/15 text-[var(--color-warning-600)]',
  received: 'bg-[var(--color-border-light)] text-muted',
}

export function DataPage() {
  const { data: addresses = [] } = useEmailIngestAddresses()
  const createAddress = useCreateEmailIngestAddress()
  const setActive = useSetEmailIngestActive()
  const deleteAddress = useDeleteEmailIngestAddress()
  const { data: logs = [] } = useEmailIngestLogs()

  const [copied, setCopied] = useState(false)
  const [allowlist, setAllowlist] = useState<string[]>([])
  const [newSender, setNewSender] = useState('')

  const address = addresses[0]

  const handleCopy = async () => {
    if (!address) return
    await navigator.clipboard.writeText(fullInboundAddress(address.inbound_alias))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleAddSender = () => {
    const email = newSender.trim().toLowerCase()
    if (!email || allowlist.includes(email)) return
    setAllowlist((prev) => [...prev, email])
    setNewSender('')
  }

  return (
    <div className="max-w-[800px] space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Data</h1>
        <p className="text-sm text-muted mt-0.5">
          Import statements by email, manage your inbound address, and review recent imports.
        </p>
      </div>

      {/* Email statement ingestion */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Mail className="h-3.5 w-3.5" />
            Email statement ingestion
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted">
            Forward your bank or credit-card statement emails to your private address below. We'll extract the
            attachment, parse it, and drop it into your Imports queue for review — nothing posts to your ledger
            without your confirmation.
          </p>

          {!address && (
            <Button onClick={() => createAddress.mutate()} disabled={createAddress.isPending}>
              {createAddress.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create my inbound address
            </Button>
          )}

          {address && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <code className="flex-1 num text-sm surface-2 border border-hairline rounded-lg px-3 py-2.5">
                  {fullInboundAddress(address.inbound_alias)}
                </code>
                <Button size="sm" variant="secondary" onClick={handleCopy}>
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setActive.mutate({ id: address.id, isActive: !address.is_active })}
                  disabled={setActive.isPending}
                >
                  {address.is_active ? 'Pause' : 'Resume'}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[var(--color-negative-600)]"
                  onClick={() => deleteAddress.mutate(address.id)}
                  disabled={deleteAddress.isPending}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-xs text-muted">
                {address.is_active
                  ? 'Active — statements sent here will be captured.'
                  : 'Paused — emails to this address are ignored.'}
              </p>
            </div>
          )}

          {/* Sender allowlist */}
          <div className="border-t border-hairline pt-4">
            <p className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-[var(--color-positive-600)]" />
              Sender allowlist
            </p>
            <p className="text-xs text-muted mb-3">
              Only emails from these addresses will be accepted. Leave empty to accept any sender (still requires
              your private inbound address).
            </p>
            <div className="flex flex-wrap gap-2 items-end">
              <div className="flex-1 min-w-[200px]">
                <Label>Sender email</Label>
                <Input
                  value={newSender}
                  onChange={(e) => setNewSender(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddSender()}
                  placeholder="e.g. statements@hdfcbank.com"
                />
              </div>
              <Button size="sm" onClick={handleAddSender} disabled={!newSender.trim()}>
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
            {allowlist.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {allowlist.map((email) => (
                  <span
                    key={email}
                    className="inline-flex items-center gap-1.5 rounded-full surface-2 border border-hairline px-2.5 py-1 text-xs"
                  >
                    {email}
                    <button
                      onClick={() => setAllowlist((prev) => prev.filter((e) => e !== email))}
                      className="text-muted hover:text-[var(--color-negative-600)]"
                      aria-label={`Remove ${email}`}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recent email ingest log */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            Recent email imports
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logs.length === 0 && (
            <p className="text-sm text-muted py-4">No email imports yet. Forward a statement to your address to get started.</p>
          )}
          {logs.length > 0 && (
            <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
              {logs.map((log) => (
                <div key={log.id} className="flex items-center justify-between py-2.5">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{log.subject || 'No subject'}</p>
                    <p className="text-xs text-muted truncate">
                      {log.sender_email || 'Unknown sender'} ·{' '}
                      {new Date(log.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {log.attachment_count != null && log.attachment_count > 0 && (
                      <span className="text-xs text-muted">{log.attachment_count} attachment{log.attachment_count === 1 ? '' : 's'}</span>
                    )}
                    <Badge className={cn('capitalize', STATUS_STYLES[log.status] ?? '')}>{log.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}