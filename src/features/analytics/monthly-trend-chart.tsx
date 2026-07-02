import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCompactCurrency } from '@/lib/utils'
import { useMonthlyTrend } from '@/features/analytics/hooks'

export function MonthlyTrendChart() {
  const { data } = useMonthlyTrend(6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Income vs expense — last 6 months</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid vertical={false} strokeOpacity={0.08} />
            <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }} />
            <YAxis
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }}
              tickFormatter={(v) => formatCompactCurrency(v)}
              width={56}
            />
            <Tooltip
              formatter={(value) => formatCompactCurrency(Number(value))}
              contentStyle={{ background: 'var(--color-surface-dark)', border: '1px solid var(--color-border-dark)', borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="income" fill="var(--color-positive-500)" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" fill="var(--color-negative-500)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
