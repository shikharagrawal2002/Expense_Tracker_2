import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { formatCurrency, cn } from '@/lib/utils'
import { useDailySpendHeatmap } from '@/features/analytics/hooks'

export function SpendingHeatmap() {
  const [monthDate, setMonthDate] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d
  })
  const { data: byDay } = useDailySpendHeatmap(monthDate)

  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate()
  const firstWeekday = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1).getDay()
  const max = byDay ? Math.max(1, ...Object.values(byDay)) : 1

  const shiftMonth = (delta: number) => {
    setMonthDate((prev) => {
      const next = new Date(prev)
      next.setMonth(next.getMonth() + delta)
      return next
    })
  }

  function intensity(amount: number) {
    if (amount === 0) return 0
    const ratio = amount / max
    if (ratio > 0.75) return 4
    if (ratio > 0.5) return 3
    if (ratio > 0.25) return 2
    return 1
  }

  const intensityColor = [
    'surface-2',
    'bg-[var(--color-brand-500)]/20',
    'bg-[var(--color-brand-500)]/45',
    'bg-[var(--color-brand-500)]/70',
    'bg-[var(--color-brand-500)]',
  ]

  return (
    <Card>
      <CardHeader>
        <CardTitle>Spending heatmap</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(-1)} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-medium min-w-[110px] text-center">
            {monthDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
          </span>
          <Button variant="ghost" size="icon" onClick={() => shiftMonth(1)} aria-label="Next month">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-7 gap-1.5 text-center">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="text-[11px] text-muted font-medium">
              {d}
            </div>
          ))}
          {Array.from({ length: firstWeekday }).map((_, i) => (
            <div key={`blank-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const amount = byDay?.[day] ?? 0
            const level = intensity(amount)
            return (
              <div
                key={day}
                title={amount > 0 ? formatCurrency(amount) : undefined}
                className={cn(
                  'aspect-square rounded-md flex items-center justify-center text-[11px] font-medium',
                  intensityColor[level],
                  level >= 3 ? 'text-white' : 'text-muted',
                )}
              >
                {day}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
