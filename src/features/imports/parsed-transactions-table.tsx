import { Badge } from '@/components/ui/skeleton'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import type { Category } from '@/lib/supabase/types'
import type { ReviewRow } from '@/features/imports/types'

interface ParsedTransactionsTableProps {
  rows: ReviewRow[]
  categories: Category[]
  currency: string
  onToggleRow: (key: string) => void
  onToggleAll: (include: boolean) => void
  onCategoryChange: (key: string, categoryId: string) => void
}

export function ParsedTransactionsTable({
  rows,
  categories,
  currency,
  onToggleRow,
  onToggleAll,
  onCategoryChange,
}: ParsedTransactionsTableProps) {
  const includedCount = rows.filter((r) => r.include).length
  const allIncluded = includedCount === rows.length && rows.length > 0

  return (
    <div className="overflow-x-auto rounded-xl border border-hairline">
      <table className="w-full text-sm">
        <thead className="surface-2 text-xs text-muted">
          <tr>
            <th className="w-10 px-3 py-2 text-left">
              <input
                type="checkbox"
                checked={allIncluded}
                onChange={(e) => onToggleAll(e.target.checked)}
                aria-label="Toggle all rows"
              />
            </th>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Description</th>
            <th className="px-3 py-2 text-left">Category</th>
            <th className="px-3 py-2 text-right">Amount</th>
            <th className="px-3 py-2 text-left">Flags</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={`border-t border-hairline ${!row.include ? 'opacity-40' : ''}`}>
              <td className="px-3 py-2">
                <input
                  type="checkbox"
                  checked={row.include}
                  onChange={() => onToggleRow(row.key)}
                  aria-label={`Include ${row.description}`}
                />
              </td>
              <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
              <td className="px-3 py-2 max-w-[280px] truncate" title={row.description}>
                {row.description}
              </td>
              <td className="px-3 py-2">
                <Select
                  className="!h-8 !text-xs min-w-[130px]"
                  value={row.categoryId ?? ''}
                  onChange={(e) => onCategoryChange(row.key, e.target.value)}
                  disabled={!row.include}
                >
                  <option value="">Uncategorized</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              </td>
              <td
                className={`px-3 py-2 text-right whitespace-nowrap font-medium ${
                  row.direction === 'credit' ? 'text-[var(--color-positive-600)]' : ''
                }`}
              >
                {row.direction === 'credit' ? '+' : '-'}
                {formatCurrency(row.amount, currency)}
              </td>
              <td className="px-3 py-2">
                <div className="flex gap-1">
                  {row.isDuplicate && <Badge variant="warning">Possible duplicate</Badge>}
                  {row.suggestedCategory && !row.categoryId && (
                    <Badge variant="default">Suggest: {row.suggestedCategory}</Badge>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="p-6 text-center text-sm text-muted">No transactions parsed yet.</p>}
      <div className="flex items-center justify-between border-t border-hairline px-3 py-2 text-xs text-muted">
        <span>
          {includedCount} of {rows.length} selected
        </span>
      </div>
    </div>
  )
}
