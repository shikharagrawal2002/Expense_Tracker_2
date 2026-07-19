import type { ParsedTransaction } from '@/lib/supabase/types'

export type ImportKind = 'bank' | 'card'

/** A parsed row plus the editable review-table state layered on top of it. */
export interface ReviewRow extends ParsedTransaction {
  /** stable key for React lists / editing, independent of array index */
  key: string
  include: boolean
  categoryId: string | null
}

export function toReviewRow(row: ParsedTransaction, index: number, defaultCategoryId: string | null): ReviewRow {
  return {
    ...row,
    key: `${index}-${row.date}-${row.amount}`,
    include: !row.isDuplicate,
    categoryId: defaultCategoryId,
  }
}
