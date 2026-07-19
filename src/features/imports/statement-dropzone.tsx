import { useCallback, useRef, useState } from 'react'
import { UploadCloud, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCEPTED = '.csv,.xls,.xlsx,.pdf'

interface StatementDropzoneProps {
  file: File | null
  onFileSelected: (file: File) => void
  disabled?: boolean
}

export function StatementDropzone({ file, onFileSelected, disabled }: StatementDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const handleFiles = useCallback(
    (files: FileList | null) => {
      if (!files || files.length === 0) return
      onFileSelected(files[0])
    },
    [onFileSelected],
  )

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && inputRef.current?.click()}
      onKeyDown={(e) => e.key === 'Enter' && !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        if (!disabled) setIsDragging(true)
      }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (!disabled) handleFiles(e.dataTransfer.files)
      }}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center cursor-pointer transition-colors',
        isDragging ? 'border-[var(--color-brand-500)] surface-2' : 'border-hairline',
        disabled && 'opacity-50 pointer-events-none',
      )}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED}
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
        disabled={disabled}
      />
      {file ? (
        <>
          <FileText className="h-6 w-6 text-[var(--color-brand-500)]" />
          <p className="text-sm font-medium">{file.name}</p>
          <p className="text-xs text-muted">{(file.size / 1024).toFixed(0)} KB — click to replace</p>
        </>
      ) : (
        <>
          <UploadCloud className="h-6 w-6 text-muted" />
          <p className="text-sm font-medium">Drop a statement here, or click to choose a file</p>
          <p className="text-xs text-muted">CSV, XLS/XLSX, or PDF</p>
        </>
      )}
    </div>
  )
}
