import { Plus, Tags, Trash2, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { useCategories, useDeleteCategory } from '@/features/categories/hooks'
import { CategoryFormDialog } from '@/features/categories/category-form-dialog'
import { getCategoryIcon } from '@/features/categories/category-meta'
import type { CategoryKind } from '@/lib/supabase/types'

const SECTIONS: { kind: CategoryKind; label: string }[] = [
  { kind: 'expense', label: 'Expense' },
  { kind: 'income', label: 'Income' },
  { kind: 'investment', label: 'Investment' },
  { kind: 'transfer', label: 'Transfer' },
]

export function CategoriesPage() {
  const { data: categories, isLoading, isError } = useCategories()
  const deleteCategory = useDeleteCategory()

  return (
    <div className="max-w-[900px] space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Categories</h1>
          <p className="text-sm text-muted mt-0.5">
            Default categories are shared and can't be edited. Add your own alongside them.
          </p>
        </div>
        <CategoryFormDialog
          trigger={
            <Button size="sm">
              <Plus className="h-4 w-4" />
              Add category
            </Button>
          }
        />
      </div>

      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      )}

      {isError && (
        <div className="surface border border-hairline rounded-2xl">
          <EmptyState icon={Tags} title="Couldn't load categories" description="Check your Supabase connection and refresh." />
        </div>
      )}

      {!isLoading &&
        !isError &&
        SECTIONS.map((section) => {
          const items = categories?.filter((c) => c.kind === section.kind) ?? []
          if (items.length === 0) return null
          return (
            <Card key={section.kind}>
              <CardHeader>
                <CardTitle>{section.label}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {items.map((cat) => {
                    const Icon = getCategoryIcon(cat.icon)
                    const isSystem = cat.user_id === null
                    return (
                      <div
                        key={cat.id}
                        className="group flex items-center gap-2 rounded-full border border-hairline pl-1.5 pr-3 py-1.5 text-sm"
                      >
                        <span
                          className="flex h-6 w-6 items-center justify-center rounded-full"
                          style={{ backgroundColor: `${cat.color}26` }}
                        >
                          <Icon className="h-3.5 w-3.5" style={{ color: cat.color }} />
                        </span>
                        {cat.name}
                        {isSystem ? (
                          <Lock className="h-3 w-3 text-muted" />
                        ) : (
                          <button
                            onClick={() => deleteCategory.mutate(cat.id)}
                            className="opacity-0 group-hover:opacity-100 text-muted hover:text-[var(--color-negative-600)] transition-opacity"
                            aria-label={`Delete ${cat.name}`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </CardContent>
            </Card>
          )
        })}
    </div>
  )
}
