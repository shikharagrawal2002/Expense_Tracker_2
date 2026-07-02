import { MonthlyTrendChart } from '@/features/analytics/monthly-trend-chart'
import { CategoryBreakdownChart } from '@/features/analytics/category-breakdown-chart'
import { SpendingHeatmap } from '@/features/analytics/spending-heatmap'

export function AnalyticsPage() {
  return (
    <div className="max-w-[1400px] space-y-5">
      <h1 className="font-display text-2xl font-semibold">Analytics</h1>
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <MonthlyTrendChart />
        <CategoryBreakdownChart />
      </div>
      <SpendingHeatmap />
    </div>
  )
}
