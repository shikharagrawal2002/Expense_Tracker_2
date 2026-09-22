import { useMemo } from 'react'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart as RePieChart,
  Pie,
  Cell,
} from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { formatCurrency, formatCompactCurrency, CHART_PALETTE } from '@/lib/utils'
import { INVESTMENT_TYPE_META } from '@/features/investments/hooks'
import type { Holding } from '@/features/investments/api'

export interface TypeSlice {
  key: string
  label: string
  invested: number
  current: number
  color: string
}

/** Groups holdings by investment type, which is the axis both charts share. */
export function groupByType(holdings: Holding[]): TypeSlice[] {
  const map = new Map<string, TypeSlice>()
  for (const h of holdings) {
    const meta = INVESTMENT_TYPE_META[h.type]
    const row = map.get(h.type) ?? { key: h.type, label: meta.label, invested: 0, current: 0, color: meta.color }
    row.invested += Number(h.invested_amount) || 0
    row.current += Number(h.current_value) || 0
    map.set(h.type, row)
  }
  return [...map.values()].sort((a, b) => b.current - a.current)
}

interface ChartProps {
  slices: TypeSlice[]
}

/** Invested vs current value per asset type — the "is my money actually
 *  growing, and where" chart. */
export function InvestedVsCurrentChart({ slices }: ChartProps) {
  const data = useMemo(
    () => slices.map((s) => ({ type: s.label, invested: s.invested, current: s.current })),
    [slices],
  )

  return (
    <Card>
      <CardHeader>
        <CardTitle>Invested vs current value</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="h-56 sm:h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }} barGap={4}>
              <CartesianGrid vertical={false} strokeOpacity={0.08} />
              <XAxis
                dataKey="type"
                tickLine={false}
                axisLine={false}
                interval={0}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.6 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 10, fill: 'currentColor', opacity: 0.5 }}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={56}
              />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'currentColor', fillOpacity: 0.04 }} />
              <Bar dataKey="invested" name="Invested" fill="var(--color-brand-400)" radius={[4, 4, 0, 0]} maxBarSize={26} />
              <Bar dataKey="current" name="Current" fill="var(--color-positive-500)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-brand-400)]" /> Invested
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-[var(--color-positive-500)]" /> Current
          </span>
        </div>
      </CardContent>
    </Card>
  )
}

/** Allocation donut with a wrapping legend that stays readable on a phone. */
export function AllocationDonut({ slices }: ChartProps) {
  const total = slices.reduce((sum, s) => sum + s.current, 0)
  if (total <= 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle>Allocation</CardTitle>
      </CardHeader>
      <CardContent className="pt-2">
        <div className="relative h-48">
          <ResponsiveContainer width="100%" height="100%">
            <RePieChart>
              <Pie
                data={slices.map((s) => ({ name: s.label, value: s.current }))}
                dataKey="value"
                nameKey="name"
                innerRadius="58%"
                outerRadius="86%"
                paddingAngle={2}
                stroke="none"
              >
                {slices.map((s, i) => (
                  <Cell key={s.key} fill={s.color || CHART_PALETTE[i % CHART_PALETTE.length]} />
                ))}
              </Pie>
              <Tooltip content={<ChartTooltip />} />
            </RePieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <p className="text-[11px] uppercase tracking-wider text-muted">Total</p>
            <p className="font-display text-base font-semibold num">{formatCompactCurrency(total)}</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 text-xs">
          {slices.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5 min-w-0">
              <span
                className="h-2 w-2 rounded-full shrink-0"
                style={{ backgroundColor: s.color || CHART_PALETTE[i % CHART_PALETTE.length] }}
              />
              <span className="truncate text-muted">{s.label}</span>
              <span className="num ml-auto shrink-0">{((s.current / total) * 100).toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

/** Per-category numbers behind the donut — current value and return %. */
export function TypeTable({ slices }: ChartProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>By category</CardTitle>
      </CardHeader>
      <CardContent className="pt-2 space-y-2.5">
        {slices.map((s) => {
          const gain = s.current - s.invested
          const pct = s.invested > 0 ? (gain / s.invested) * 100 : 0
          return (
            <div key={s.key} className="flex items-center gap-3">
              <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-sm truncate flex-1 min-w-0">{s.label}</span>
              <span className="text-sm num shrink-0">{formatCurrency(s.current)}</span>
              <span
                className={
                  gain >= 0
                    ? 'text-xs num shrink-0 w-14 text-right text-[var(--color-positive-600)]'
                    : 'text-xs num shrink-0 w-14 text-right text-[var(--color-negative-600)]'
                }
              >
                {gain >= 0 ? '+' : ''}
                {pct.toFixed(1)}%
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}