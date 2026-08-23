import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileText, Loader2, Check, AlertTriangle, PieChart } from 'lucide-react'
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label, Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { cn } from '@/lib/utils'
import { useParsePortfolio } from '@/features/investments/hooks'
import type { PortfolioReportType } from '@/features/investments/api'

const ACCEPTED = '.csv,.xls,.xlsx,.pdf'

const REPORT_OPTIONS: Array<{ value: PortfolioReportType; label: string; hint: string }> = [
  { value: 'holdings', label: 'Holdings', hint: 'Groww → Portfolio → Holdings → Export' },
  { value: 'transactions', label: 'Transactions', hint: 'Groww → Portfolio → Transactions → Export' },
  { value: 'capital-gains', label: 'Capital gains', hint: 'Groww → Portfolio → Capital Gains → Export' },
]

interface GrowwImportDialogProps {
  trigger: React.ReactNode
}

export function GrowwImportDialog({ trigger }: GrowwImportDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [reportType, setReportType] = useState<PortfolioReportType>('holdings')
  const [password, setPassword] = useState('')
  const [result, setResult] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [open, setOpen] = useState(false)

  const parsePortfolio = useParsePortfolio()

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return
    setFile(files[0])
    setResult(null)
    setError(null)
  }, [])

  const handleImport = async () => {
    if (!file) return
    setError(null)
    setResult(null)
    try {
      const res = await parsePortfolio.mutateAsync({
        file,
        reportType,
        password: password || undefined,
      })
      if (res.reportType === 'holdings') {
        setResult(
          `Imported ${res.holdingsDetected ?? 0} holding${(res.holdingsDetected ?? 0) === 1 ? '' : 's'} — ` +
            `${res.created ?? 0} created, ${res.matched ?? 0} matched, ${res.updated ?? 0} updated.`,
        )
      } else {
        setResult(
          `Imported ${res.transactionsDetected ?? 0} transaction${(res.transactionsDetected ?? 0) === 1 ? '' : 's'} — ` +
            `${res.inserted ?? 0} inserted.`,
        )
      }
      setFile(null)
      setPassword('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  const handleClose = () => {
    setOpen(false)
    setFile(null)
    setPassword('')
    setResult(null)
    setError(null)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => (o ? setOpen(true) : handleClose())}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent
        title="Import from Groww"
        description="Upload a Groww mutual-fund export to sync your holdings and transaction history."
      >
        <div className="space-y-4">
          <div>
            <Label>Report type</Label>
            <Select value={reportType} onChange={(e) => setReportType(e.target.value as PortfolioReportType)} className="mt-1">
              {REPORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label} — {opt.hint}
                </option>
              ))}
            </Select>
            <p className="mt-1 text-xs text-muted">
              Auto-detected from the filename if you're not sure — just pick the closest match.
            </p>
          </div>

          <div
            role="button"
            tabIndex={0}
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => e.key === 'Enter' && inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault()
              setIsDragging(false)
              handleFiles(e.dataTransfer.files)
            }}
            className={cn(
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
              isDragging ? 'border-[var(--color-brand-500)] surface-2' : 'border-hairline',
            )}
          >
            <input
              ref={inputRef}
              type="file"
              accept={ACCEPTED}
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            {file ? (
              <>
                <FileText className="h-6 w-6 text-[var(--color-brand-500)]" />
                <p className="text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB — click to replace</p>
              </>
            ) : (
              <>
                <PieChart className="h-6 w-6 text-muted" />
                <p className="text-sm font-medium">Drop a Groww export here, or click to choose a file</p>
                <p className="text-xs text-muted">CSV, XLS/XLSX, or PDF</p>
              </>
            )}
          </div>

          {file && /\.(pdf|xls|xlsx)$/i.test(file.name) && (
            <div>
              <Label htmlFor="groww-password">File password (if locked)</Label>
              <Input
                id="groww-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Leave blank if not password-protected"
                autoComplete="off"
              />
              <p className="mt-1 text-xs text-muted">
                Common for capital-gains PDFs — Groww often locks them with your PAN or date of birth.
              </p>
            </div>
          )}

          <Button onClick={handleImport} disabled={!file || parsePortfolio.isPending} className="w-full">
            {parsePortfolio.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importing…
              </>
            ) : (
              <>
                <UploadCloud className="h-4 w-4" />
                Import
              </>
            )}
          </Button>

          {error && (
            <p className="flex items-center gap-2 text-sm text-[var(--color-negative-600)]">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </p>
          )}

          {result && (
            <p className="flex items-center gap-2 text-sm text-[var(--color-positive-600)]">
              <Check className="h-4 w-4 shrink-0" />
              {result}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}