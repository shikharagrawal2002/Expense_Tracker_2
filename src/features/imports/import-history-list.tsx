import { History, Undo2 } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/shared/empty-state'
import { useImportBatches, useUndoImportBatch } from '@/features/imports/hooks'

const STATUS_VARIANT = {
  completed: 'positive',
  processing: 'default',
  pending: 'default',
  failed: 'negative',
} as const

export function ImportHistoryList() {
  const { data: batches, isLoading } = useImportBatches()
  const undoBatch = useUndoImportBatch()

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent imports</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && (!batches || batches.length === 0) && (
          <EmptyState
            icon={History}
            title="No imports yet"
            description="Statement uploads you confirm will show up here, with an undo option in case a batch parsed wrong."
          />
        )}
        {!isLoading && batches && batches.length > 0 && (
          <div className="space-y-2">
            {batches.map((batch) => (
              <div
                key={batch.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-hairline px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{batch.file_name ?? 'Untitled statement'}</p>
                  <p className="text-xs text-muted">
                    {new Date(batch.created_at).toLocaleDateString()} · {batch.imported_count ?? 0} imported
                    {batch.duplicate_count ? `, ${batch.duplicate_count} skipped as duplicates` : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant={STATUS_VARIANT[batch.status]}>{batch.status}</Badge>
                  {batch.status === 'completed' && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => undoBatch.mutate(batch.id)}
                      disabled={undoBatch.isPending}
                      title="Undo this import"
                    >
                      <Undo2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
