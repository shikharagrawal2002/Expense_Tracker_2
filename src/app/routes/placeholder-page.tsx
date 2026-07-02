import type { LucideIcon } from 'lucide-react'
import { Construction } from 'lucide-react'
import { EmptyState } from '@/components/shared/empty-state'

export function PlaceholderPage({ title, icon = Construction }: { title: string; icon?: LucideIcon }) {
  return (
    <div className="max-w-[1400px]">
      <h1 className="font-display text-2xl font-semibold mb-6">{title}</h1>
      <div className="surface border border-hairline rounded-2xl">
        <EmptyState
          icon={icon}
          title={`${title} is coming next`}
          description="This module's schema is already in place — the UI is built feature-by-feature after the dashboard shell."
        />
      </div>
    </div>
  )
}
