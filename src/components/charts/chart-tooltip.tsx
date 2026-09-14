import { formatCurrency } from '@/lib/utils'

interface TooltipEntry {
  name?: string | number
  value?: number | string
  color?: string
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipEntry[]
  label?: string | number
}

/** Shared Recharts tooltip that respects light/dark mode (the old inline
 *  contentStyle hardcoded a dark background even in light mode). Renders values
 *  with the same tabular-mono treatment used everywhere money appears. */
export function ChartTooltip({ active, payload, label }: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="surface-popover border border-hairline rounded-lg shadow-card px-3 py-2 text-xs">
      {label !== undefined && <p className="font-medium mb-1">{label}</p>}
      <div className="space-y-0.5">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: entry.color }} />
            <span className="text-muted capitalize">{entry.name}</span>
            <span className="num ml-auto font-medium">{formatCurrency(Number(entry.value))}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
