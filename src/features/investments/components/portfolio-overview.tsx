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
import { TrendingUp, TrendingDown, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { ChartTooltip } from '@/components/charts/chart-tooltip'
import { formatCurrency, formatCompactCurrency, cn, CHART_PALETTE } from '@/lib/utils'
import { INVESTMENT_TYPE_META } from '@/features/investments/hooks'
import { formatPct, type HoldingMetrics, type TaxSummary } from '@/features/investments/metrics'
import type { Holding } from '@/features/investments/api'

interface PortfolioOverviewProps {
  holdings: Holding[]
  metrics: Map<string, HoldingMetrics>
  tax: TaxSummary
}

/** Value-weighted average of a metric — a ₹5 L holding counts more than a ₹5 k
 *  one, which is how asset managers report portfolio XIRR/CAGR. */
function weightedAverage(
  holdings: Holding[],
  metrics: Map<string, HoldingMetrics>,
  pick: (m: HoldingMetrics) => number | null,
): number | null {
  let weighted = 0
  let totalWeight = 0
  for (const h of holdings) {
    const m = metrics.get(h.id)
    if (!m) continue
    const value = pick(m)
    const weight = Number(h.current_value) || 0
    if (value === null || weight <= 0) continue
    weighted += value * weight
    totalWeight += weight
  }
  return totalWeight > 0 ? weighted / totalWeight : null
}

/** One row per investment type: invested vs current. */
function byTypeBreakdown(holdings: Holding[]) {
  const map = new Map<string, { label: string; invested: number; current: number; color: string }>()
  for (const h of holdings) {
    const meta = INVESTMENT_TYPE_META[h.type]
    const row = map.get(h.type) ?? { label: meta.label, invested: 0, current: 0, color: meta.color }
    row.invested += Number(h.invested_amount) || 0
    row.current += Number(h.current_value) || 0
    map.set(h.type, row)
  }
  return [...map.values()].sort((a, b) => b.current - a.current)
}

/** Small labelled chip used inside the tax snapshot. */
function TaxPill({ label, value, rate }: { label: string; value?: number; rate: number }) {
  return (
    <div className="surface-2 border border-hairline rounded-lg p-2.5">
      <p className="text-[10px] uppercase tracking-wider text-muted">{label}</p>
      {value !== undefined && <p className="font-display text-sm font-semibold num mt-0.5">{formatCurrency(value)}</p>}
      <p className="text-xs num text-muted mt-0.5">tax {formatCurrency(rate)}</p>
    </div>
  )
}

export function PortfolioOverview({ holdings, metrics, tax }: PortfolioOverviewProps) {
  const totalInvested = holdings.reduce((sum, h) => sum + (Number(h.invested_amount) || 0), 0)
  const totalCurrent = holdings.reduce((sum, h) => sum + (Number(h.current_value) || 0), 0)
  const totalGain = totalCurrent - totalInvested
  const gainPct = totalInvested > 0 ? (totalGain / totalInvested) * 100 : 0
  const portfolioXirr = weightedAverage(holdings, metrics, (m) => m.xirr)
  const portfolioCagr = weightedAverage(holdings, metrics, (m) => m.cagr)

      const breakdown = useMemo(() => byTypeBreakdown(holdings), [holdings])
  const barData = breakdown.map((r) => ({ name: r.label, invested: r.invested, current: r.current }))
  const pieData = breakdown.map((r, i) => ({
    name: r.label,
    value: r.current,
    color: r.color || CHART_PALETTE[i % CHART_PALETTE.length],
  }))

  return (
    <div className="space-y-5">
      {/* KPI row — 2 per row on phones so numbers stay readable. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4 px-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Current value</p>
            <p className="font-display text-xl sm:text-2xl font-semibold mt-1.5 num">{formatCurrency(totalCurrent)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 px-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Invested</p>
            <p className="font-display text-xl sm:text-2xl font-semibold mt-1.5 num">{formatCurrency(totalInvested)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 px-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">Total gain</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              {totalGain >= 0 ? (
                <TrendingUp className="h-4 w-4 shrink-0 text-[var(--color-positive-600)]" />
              ) : (
                <TrendingDown className="h-4 w-4 shrink-0 text-[var(--color-negative-600)]" />
              )}
              <p
                className={cn(
                  'font-display text-xl sm:text-2xl font-semibold num truncate',
                  totalGain >= 0 ? 'text-[var(--color-positive-600)]' : 'text-[var(--color-negative-600)]',
                )}
              >
                {totalGain >= 0 ? '+' : '−'}
                {formatCurrency(Math.abs(totalGain))}
              </p>
            </div>
            <p
              className={cn(
                'text-xs num mt-0.5 truncate',
                totalGain >= 0 ? 'text-[var(--color-positive-600)]' : 'text-[var(--color-negative-600)]',
              )}
            >
              {gainPct.toFixed(1)}% overall
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 px-3.5">
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted">XIRR · CAGR</p>
            <p className="font-display text-xl sm:text-2xl font-semibold mt-1.5 num">{formatPct(portfolioXirr)}</p>
            <p className="text-xs text-muted num mt-0.5">CAGR {formatPct(portfolioCagr)}</p>
                    </CardContent>
        </Card>
      </div>

      {/* Charts — stacked on phone, 2 columns on tablet+. */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Invested vs current by category</CardTitle>
          </CardHeader>
          <CardContent className="h-60 pt-0">
            {barData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted">No holdings to chart</div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} margin={{ top: 8, right: 8, left: -10, bottom: 0 }} barGap={6}>
                  <CartesianGrid vertical={false} strokeOpacity={0.08} />
                  <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }} />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={48}
                    tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.55 }}
                    tickFormatter={(v) => formatCompactCurrency(Number(v))}
                  />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-border-dark)', strokeOpacity: 0.4, strokeWidth: 1 }} />
                  <Bar dataKey="invested" name="Invested" fill="var(--color-border-dark)" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="current" name="Current value" fill="var(--color-brand-500)" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Portfolio allocation</CardTitle>
          </CardHeader>
          <CardContent className="h-60 pt-0">
            {pieData.length === 0 ? (
              <div className="h-full flex items-center justify-center text-sm text-muted">No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie data={pieData} dataKey="value" innerRadius={44} outerRadius={70} paddingAngle={2} stroke="var(--surface-1)">
                      {pieData.map((entry) => (
                        <Cell key={entry.name} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<ChartTooltip />} />
                  </RePieChart>
                </ResponsiveContainer>
                <div className="mt-2 flex flex-wrap gap-2 text-xs">
                  {pieData.map((entry) => (
                    <span key={entry.name} className="inline-flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full" style={{ backgroundColor: entry.color }} />
                      <span className="text-muted">{entry.name}</span>
                      <span className="num font-medium">{formatPct((totalCurrent > 0 ? entry.value / totalCurrent : 0))}</span>
                    </span>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Estimated tax liability snapshot. */}
      <Card>
        <CardHeader>
          <CardTitle>Estimated tax liability</CardTitle>
        </CardHeader>
        <CardContent className="pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <TaxPill label="Short-term" value={tax.shortTermGains} rate={tax.shortTermTax} />
            <TaxPill label="Long-term" value={tax.longTermGains} rate={tax.longTermTax} />
            <TaxPill label="Flat-rate (crypto)" value={undefined} rate={tax.flatTax} />
            <TaxPill label="Exempt (PPF/EPF)" value={tax.exemptGains} rate={0} />
          </div>
          <div className="mt-2.5 flex items-start gap-1.5 text-xs text-muted">
            <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <p>
              Based on Indian rules for FY 2025-26: 12.5% LTCG on equity (above the ₹1.25 L exemption),
              30% STCG, 30% flat on crypto, slab rate+indexation on debt/gold. Your actual bill
              depends on your slab and any carried-forward losses &mdash; this is planning guidance only.
            </p>
                    </div>
        </CardContent>
      </Card>
    </div>
  )
}
