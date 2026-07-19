import { supabase } from '@/lib/supabase/client'
import type {
  ImportBatch,
  NewImportBatch,
  NewTransaction,
  NewCardStatement,
  CardStatement,
  ParseStatementResult,
} from '@/lib/supabase/types'
import type { ImportKind } from '@/features/imports/types'

export function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      // reader.result is a data: URL ("data:<mime>;base64,AAAA...") — strip the prefix
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error ?? new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}

export async function parseStatementFile(params: {
  file: File
  kind: ImportKind
  accountId: string
}): Promise<ParseStatementResult> {
  const fileBase64 = await readFileAsBase64(params.file)
  const { data, error } = await supabase.functions.invoke<ParseStatementResult>('parse-statement', {
    body: {
      kind: params.kind,
      accountId: params.accountId,
      fileName: params.file.name,
      mimeType: params.file.type,
      fileBase64,
    },
  })
  if (error) throw error
  if (!data) throw new Error('The parser returned no data')
  return data
}

export async function createImportBatch(input: NewImportBatch): Promise<ImportBatch> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('import_batches')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as ImportBatch
}

export async function updateImportBatch(id: string, patch: Partial<NewImportBatch>): Promise<void> {
  const { error } = await supabase.from('import_batches').update(patch).eq('id', id)
  if (error) throw error
}

export async function fetchImportBatches(): Promise<ImportBatch[]> {
  const { data, error } = await supabase
    .from('import_batches')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)
  if (error) throw error
  return data as ImportBatch[]
}

export async function undoImportBatch(id: string): Promise<void> {
  const { error } = await supabase.rpc('undo_import_batch', { p_batch_id: id })
  if (error) throw error
}

/** Bulk-inserts confirmed transactions from a review table. Supabase's insert
 *  already accepts an array, so this is one round-trip regardless of row count. */
export async function bulkInsertTransactions(rows: NewTransaction[]): Promise<number> {
  if (rows.length === 0) return 0
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { error, count } = await supabase
    .from('transactions')
    .insert(rows.map((row) => ({ ...row, user_id: userId, currency: row.currency ?? 'INR' })), {
      count: 'exact',
    })
  if (error) throw error
  return count ?? rows.length
}

export async function upsertCardStatement(input: NewCardStatement): Promise<CardStatement> {
  const { data, error } = await supabase
    .from('card_statements')
    .upsert(input, { onConflict: 'account_id,statement_month' })
    .select('*')
    .single()
  if (error) throw error
  return data as CardStatement
}
