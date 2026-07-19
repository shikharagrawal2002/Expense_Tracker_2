import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  parseStatementFile,
  createImportBatch,
  updateImportBatch,
  fetchImportBatches,
  undoImportBatch,
  bulkInsertTransactions,
  upsertCardStatement,
} from '@/features/imports/api'
import type { ImportKind } from '@/features/imports/types'
import type { NewTransaction, NewCardStatement } from '@/lib/supabase/types'

const IMPORT_BATCHES_KEY = ['import-batches'] as const

export function useImportBatches() {
  return useQuery({ queryKey: IMPORT_BATCHES_KEY, queryFn: fetchImportBatches })
}

export function useParseStatement() {
  return useMutation({
    mutationFn: (params: { file: File; kind: ImportKind; accountId: string }) => parseStatementFile(params),
  })
}

/** Confirms a bank-statement import: writes the batch row, inserts the
 *  selected transactions tagged with that batch, then marks it completed. */
export function useConfirmBankImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      accountId: string
      fileName: string
      rowCount: number
      duplicateCount: number
      transactions: NewTransaction[]
    }) => {
      const batch = await createImportBatch({
        source: 'bank_statement',
        account_id: params.accountId,
        file_name: params.fileName,
        row_count: params.rowCount,
        duplicate_count: params.duplicateCount,
        status: 'processing',
      })
      try {
        const imported = await bulkInsertTransactions(
          params.transactions.map((t) => ({ ...t, import_batch_id: batch.id })),
        )
        await updateImportBatch(batch.id, { imported_count: imported, status: 'completed' })
        return { batchId: batch.id, imported }
      } catch (err) {
        await updateImportBatch(batch.id, { status: 'failed' })
        throw err
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

/** Confirms a credit-card statement import: writes the card_statements row
 *  (due date / bill amount / minimum due) and the transaction list, both
 *  tagged with the same batch for traceability/undo. */
export function useConfirmCardImport() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: {
      accountId: string
      fileName: string
      rowCount: number
      duplicateCount: number
      cardStatement: NewCardStatement
      transactions: NewTransaction[]
    }) => {
      const batch = await createImportBatch({
        source: 'bank_statement',
        account_id: params.accountId,
        file_name: params.fileName,
        row_count: params.rowCount,
        duplicate_count: params.duplicateCount,
        status: 'processing',
      })
      try {
        await upsertCardStatement({ ...params.cardStatement, import_batch_id: batch.id })
        const imported = await bulkInsertTransactions(
          params.transactions.map((t) => ({ ...t, import_batch_id: batch.id })),
        )
        await updateImportBatch(batch.id, { imported_count: imported, status: 'completed' })
        return { batchId: batch.id, imported }
      } catch (err) {
        await updateImportBatch(batch.id, { status: 'failed' })
        throw err
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useUndoImportBatch() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => undoImportBatch(id),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: IMPORT_BATCHES_KEY })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}
