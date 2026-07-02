import { KpiRow } from '@/features/dashboard/components/kpi-row'
import { CashflowChart } from '@/features/dashboard/components/cashflow-chart'
import { BudgetStatusList } from '@/features/dashboard/components/budget-status-list'
import { UpcomingBillsCard } from '@/features/dashboard/components/upcoming-bills-card'
import { RecentActivityList } from '@/features/dashboard/components/recent-activity-list'
import { AiInsightsPanel } from '@/features/dashboard/components/ai-insights-panel'
import { useAuth } from '@/features/auth/use-auth'

function timeOfDayGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

export function DashboardPage() {
  const { user } = useAuth()
  const firstName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? user?.email?.split('@')[0]

  return (
    <div className="space-y-5 max-w-[1400px]">
      <div>
        <h1 className="font-display text-2xl font-semibold">
          {timeOfDayGreeting()}{firstName ? `, ${firstName}` : ''}
        </h1>
        <p className="text-sm text-muted mt-0.5">Here's where your money stands today.</p>
      </div>

      <KpiRow />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
        <div className="xl:col-span-2 space-y-5">
          <CashflowChart />
          <RecentActivityList />
        </div>
        <div className="space-y-5">
          <AiInsightsPanel />
          <BudgetStatusList />
          <UpcomingBillsCard />
        </div>
      </div>
    </div>
  )
}
