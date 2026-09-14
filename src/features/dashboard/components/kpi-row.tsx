import { CreditCard, HandCoins } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { ProgressRing } from '@/components/ui/progress-ring'
import { Skeleton } from '@/components/ui/skeleton'
import { CountUp } from '@/components/ui/count-up'
import { formatCompactCurrency, cn } from '@/lib/utils'
import { useDashboardKpis } from '@/features/dashboard/use-dashboard-data'

export function KpiRow() {
  const { data, isLoading } = useDashboardKpis()

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Skeleton className="h-36 rounded-2xl sm:col-span-2" />
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-36 rounded-2xl" />
      </div>
    )
  }

  const { creditUtilization, healthScore, owedToYou } = data
  const scoreColor =
    healthScore >= 70
      ? 'var(--color-positive-500)'
      : healthScore >= 40
        ? 'var(--color-warning-500)'
        : 'var(--color-negative-500)'
  const scoreLabel = healthScore >= 70 ? 'Good shape' : healthScore >= 40 ? 'Room to improve' : 'Needs attention'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* HERO — financial health score, spans 2 columns on tablet+ */}
      <Card className="sm:col-span-2 relative overflow-hidden lg:col-span-2">
        <div
          className="absolute inset-0 pointer-events-none opacity-[0.5] dark:opacity-[0.25] lg:hidden"
          style={{
            background:
              'radial-gradient(120% 120% at 100% 0%, color-mix(in srgb, var(--color-brand-500) 12%, transparent), transparent 60%)',
          }}
        />
        <CardContent className="pt-5 sm:pt-6 flex items-center gap-4 sm:gap-6 relative">
          <ProgressRing value={healthScore} size={80} strokeWidth={7} color={scoreColor}>
            <div className="flex flex-col items-center leading-none">
              <CountUp value={healthScore} className="font-display text-2xl sm:text-3xl font-semibold num" />
              <span className="text-[10px] text-muted mt-1 uppercase tracking-wider">/ 100</span>
            </div>
          </ProgressRing>
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Financial health</p>
            <p className="font-display text-lg sm:text-xl font-semibold mt-1">{scoreLabel}</p>
            <p className="text-xs sm:text-sm text-muted mt-1 max-w-[220px]">
              A blend of your credit utilization and account health. Higher is better.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Credit utilization</p>
            <CreditCard className="h-3.5 w-3.5 text-muted" />
          </div>
          <p className="font-display text-xl sm:text-2xl font-semibold mt-2 num">
            <CountUp value={creditUtilization} format={(n) => `${Math.round(n)}%`} />
          </p>
          <div className="h-1.5 rounded-full surface-2 mt-3 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-[width] duration-700 ease-out',
                creditUtilization < 30 ? 'bg-[var(--color-positive-500)]' : 'bg-[var(--color-warning-500)]',
              )}
              style={{ width: `${creditUtilization}%` }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-4 sm:pt-5">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wider text-muted">Owed to you</p>
            <HandCoins className="h-3.5 w-3.5 text-muted" />
          </div>
          <p
            className={cn(
              'font-display text-xl sm:text-2xl font-semibold mt-2 num',
              owedToYou > 0 && 'text-[var(--color-positive-600)] dark:text-[var(--color-positive-dark)]',
            )}
          >
            <CountUp value={owedToYou} format={(n) => formatCompactCurrency(n)} />
          </p>
          <p className="text-xs text-muted mt-1">{owedToYou > 0 ? 'across pending splits' : 'all settled up'}</p>
        </CardContent>
      </Card>
    </div>
  )
}
