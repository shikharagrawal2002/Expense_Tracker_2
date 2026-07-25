import { useState } from 'react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { EmptyState } from '@/components/shared/empty-state'
import { formatCurrency } from '@/lib/utils'
import { useCategoryBreakdown } from '@/features/analytics/hooks'
import { PieChart as PieChartIcon } from 'lucide-react'

const PERIOD_OPTIONS: Array<{ value: string; label: string }> = [
  { value: '1', label: 'This month' },
  { value: '3', label: 'Last 3 months' },
  { value: '6', label: 'Last 6 months' },
  { value: '12', label: 'Last 12 months' },
  { value: 'all', label: 'All time' },
]

export function CategoryBreakdownChart() {
  const [period, setPeriod] = useState('all')
  const monthsBack = period === 'all' ? 'all' : Number(period)
  const { data: slices, isLoading } = useCategoryBreakdown(monthsBack)
  const total = slices?.reduce((sum, s) => sum + s.total, 0) ?? 0

  return (
    <Card>
      <CardHeader>
        <CardTitle>Category breakdown</CardTitle>
        <Select value={period} onChange={(e) => setPeriod(e.target.value)} className="!h-8 !w-auto !text-xs">
          {PERIOD_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </CardHeader>
      <CardContent>
        {!isLoading && slices?.length === 0 && (
          <EmptyState icon={PieChartIcon} title="No expenses yet" description="Add transactions to see where your money goes." />
        )}
        {slices && slices.length > 0 && (
          <div className="flex items-center gap-4">
            <div className="h-48 w-48 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={slices} dataKey="total" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                    {slices.map((s) => (
                      <Cell key={s.categoryId} fill={s.color} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value))}
                    contentStyle={{ background: 'var(--color-surface-dark)', border: '1px solid var(--color-border-dark)', borderRadius: 8, fontSize: 12 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 min-w-0 space-y-2 max-h-48 overflow-y-auto">
              {slices.slice(0, 8).map((s) => (
                <div key={s.categoryId} className="flex items-center gap-2 text-sm">
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                  <span className="flex-1 truncate">{s.name}</span>
                  <span className="num text-muted shrink-0">{total > 0 ? Math.round((s.total / total) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
