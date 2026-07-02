import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { formatCompactCurrency } from '@/lib/utils'
import { useMonthlyTrend } from '@/features/analytics/hooks'

export function CashflowChart() {
  const { data, isLoading } = useMonthlyTrend(6)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cashflow — last 6 months</CardTitle>
      </CardHeader>
      <CardContent className="h-72 pt-0">
        {isLoading ? (
          <Skeleton className="h-full" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 10, right: 8, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-positive-500)" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="var(--color-positive-500)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-negative-500)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--color-negative-500)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} strokeOpacity={0.08} />
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: 'currentColor', opacity: 0.5 }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.5 }}
                tickFormatter={(v) => formatCompactCurrency(v)}
                width={56}
              />
              <Tooltip
                formatter={(value) => formatCompactCurrency(Number(value))}
                contentStyle={{
                  background: 'var(--color-surface-dark)',
                  border: '1px solid var(--color-border-dark)',
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area type="monotone" dataKey="income" stroke="var(--color-positive-500)" fill="url(#incomeGrad)" strokeWidth={2} />
              <Area type="monotone" dataKey="expense" stroke="var(--color-negative-500)" fill="url(#expenseGrad)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
