import { useMemo, useState } from 'react'
import { Plus, LineChart, Trash2, RefreshCw, Loader2, Clock, BarChart2, PiggyBank, Pencil, UploadCloud } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { EmptyState } from '@/components/shared/empty-state'
import { Select } from '@/components/ui/select'
import { formatCurrency } from '@/lib/utils'
import { useHoldings, useDeleteHolding, useRefreshNav, useAllHoldingTransactions, INVESTMENT_TYPE_META, INVESTMENT_TYPES } from '@/features/investments/hooks'
import { HoldingFormDialog } from '@/features/investments/holding-form-dialog'
import { GrowwImportDialog } from '@/features/investments/groww-import-dialog'
import { PortfolioOverview } from '@/features/investments/components/portfolio-overview'
import { computeMetrics, rankByPeer, summariseTax, formatPct, type HoldingMetrics } from '@/features/investments/metrics'
import type { Holding, HoldingTransaction, InvestmentType } from '@/features/investments/api'

type TermFilter = 'all' | 'long' | 'short'
type SortKey = 'value' | 'gain' | 'xirr' | 'name'

function groupTransactions(txs: HoldingTransaction[]): Map<string, HoldingTransaction[]> {
  const map = new Map<string, HoldingTransaction[]>()
  for (const t of txs) {
    const list = map.get(t.holding_id) ?? []
    list.push(t)
    map.set(t.holding_id, list)
  }
  return map
}

function Pill({ text }: { text: string }) {
  return <span className="text-[10px] num text-muted">{text}</span>
}
export function InvestmentsPage() {
  const { data: holdings, isLoading, isError, isFetching, refetch } = useHoldings()
  const txns = useAllHoldingTransactions()
  const deleteHolding = useDeleteHolding()
  const refreshNav = useRefreshNav()
  const transactions = useMemo(() => txns.data ?? [], [txns.data])
  const txnsByHolding = useMemo(() => groupTransactions(transactions), [transactions])

  const metrics = useMemo(() => {
    const map = new Map<string, HoldingMetrics>()
    if (!holdings) return map
    const now = new Date()
    for (const h of holdings) {
      map.set(h.id, computeMetrics(h, txnsByHolding.get(h.id), now))
    }
    const ranks = rankByPeer(holdings, map)
    for (const [id, { rank, peers }] of ranks) {
      const m = map.get(id)
      if (m) {
        m.rank = rank
        m.peers = peers
      }
    }
    return map
  }, [holdings, transactions])

  const tax = useMemo(
    () => summariseTax((holdings ?? []).map((h) => ({ metrics: metrics.get(h.id)!, gain: metrics.get(h.id)?.gain ?? 0 }))),
    [metrics, holdings],
  )

  const [typeFilter, setTypeFilter] = useState<InvestmentType | 'all'>('all')
  const [termFilter, setTermFilter] = useState<TermFilter>('all')
  const [sortKey, setSortKey] = useState<SortKey>('value')

  const visibleHoldings = useMemo(() => {
    if (!holdings) return []
    return holdings
      .filter((h) => (typeFilter === 'all' ? true : h.type === typeFilter))
      .filter((h) => {
        if (termFilter === 'all') return true
        const m = metrics.get(h.id)
        return !!m && m.taxTerm === termFilter
      })
      .sort((a, b) => {
        const ma = metrics.get(a.id)
        const mb = metrics.get(b.id)
        switch (sortKey) {
          case 'value':
            return b.current_value - a.current_value
          case 'gain':
            return (mb?.gainPct ?? 0) - (ma?.gainPct ?? 0)
          case 'xirr':
            return (mb?.xirr ?? 0) - (ma?.xirr ?? 0)
          case 'name':
            return a.name.localeCompare(b.name)
          default:
            return 0
        }
      })
  }, [holdings, typeFilter, termFilter, sortKey, metrics])

  return (
    <div className="max-w-[1100px] space-y-5">
      {/* Header — every control is visible on mobile, not just desktop. */}
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold">Investments</h1>
          <p className="text-sm text-muted mt-0.5 flex items-center gap-1.5">
            <Clock className={`h-3 w-3 ${isFetching ? 'animate-spin text-muted' : 'text-[var(--color-positive-600)]'}`} />
            Real-time market data &middot; auto-refreshes every 60s
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="secondary"
            onClick={() => refreshNav.mutate()}
            disabled={refreshNav.isPending || txns.isFetching}
            aria-label="Refresh NAV values"
          >
            {refreshNav.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <GrowwImportDialog
            trigger={
              <Button size="sm" variant="secondary" aria-label="Import portfolio">
                <UploadCloud className="h-4 w-4" />
                <span className="hidden sm:inline">Import</span>
              </Button>
            }
          />
          <HoldingFormDialog
            trigger={
              <Button size="sm" aria-label="Add holding">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Add</span>
              </Button>
            }
          />
        </div>
      </div>

      {isLoading ? (
        <PortfolioSkeleton />
      ) : isError ? (
        <Card>
          <EmptyState
            icon={LineChart}
            title="Couldn't load holdings"
            description="Check your Supabase connection and refresh."
            actionLabel="Retry"
            onAction={() => refetch()}
          />
        </Card>
      ) : !holdings || holdings.length === 0 ? (
        <Card>
          <EmptyState
            icon={PiggyBank}
            title="No holdings yet"
            description="Add mutual funds, stocks, crypto, gold, FD, or EPF/PPF to track your portfolio."
          />
        </Card>
      ) : (
        <>
          <PortfolioOverview holdings={holdings} metrics={metrics} tax={tax} />

          {/* Filters + sort — a compact card so they're discoverable on mobile. */}
          <Card>
            <CardHeader>
              <CardTitle>Holdings</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex flex-wrap items-center gap-2 pb-2">
                <div className="flex items-center gap-1.5 text-xs text-muted">
                  <BarChart2 className="h-3.5 w-3.5" />
                  {visibleHoldings.length} holding{visibleHoldings.length !== 1 ? 's' : ''}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                                  <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as InvestmentType | 'all')}>
                    <option value="all">All types</option>
                    {INVESTMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {INVESTMENT_TYPE_META[t].label}
                      </option>
                    ))}
                  </Select>
                  <Select value={termFilter} onChange={(e) => setTermFilter(e.target.value as TermFilter)}>
                    <option value="all">Any term</option>
                    <option value="long">Long-term</option>
                    <option value="short">Short-term</option>
                  </Select>
                  <Select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}>
                    <option value="value">Sort by value</option>
                    <option value="gain">Sort by gain %</option>
                    <option value="xirr">Sort by XIRR</option>
                    <option value="name">Sort by name</option>
                  </Select>
                </div>
              </div>

              <div className="divide-y divide-[var(--color-border-light)] dark:divide-[var(--color-border-dark)]">
                {visibleHoldings.map((h) => {
                  const m = metrics.get(h.id)
                  const meta = INVESTMENT_TYPE_META[h.type]
                  const Icon = meta.icon
                  const termPill =
                    m?.taxTerm === 'long' ? 'Long-term' : m?.taxTerm === 'short' ? 'Short-term' : m?.taxTerm === 'flat' ? 'Flat tax' : m?.taxTerm === 'exempt' ? 'Exempt' : null
                  const rankInfo = m ? `${m.rank} of ${m.peers}` : null
                  return (
                    <HoldingRow
                      key={h.id}
                      holding={h}
                      meta={meta}
                      Icon={Icon}
                      metrics={m}
                      termPill={termPill}
                      rankInfo={rankInfo}
                      deleteHolding={deleteHolding}
                    />
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function HoldingRow({ holding, meta, Icon, metrics, termPill, rankInfo, deleteHolding }: {
  holding: Holding
  meta: { label: string; icon: React.ComponentType<any>; color: string }
  Icon: React.ComponentType<any>
  metrics: HoldingMetrics | undefined
  termPill: string | null
  rankInfo: string | null
  deleteHolding: ReturnType<typeof useDeleteHolding>
}) {
  const gain = metrics?.gain ?? (holding.current_value - holding.invested_amount)
  const gainPct = metrics?.gainPct ?? (holding.invested_amount > 0 ? (gain / holding.invested_amount) * 100 : 0)
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: `${meta.color}1f` }}>
        {Icon && <Icon className="h-4 w-4" style={{ color: meta.color }} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <p className="text-sm font-medium truncate">{holding.name}</p>
          {rankInfo ? <Pill text={`#${rankInfo}`} /> : null}
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <p className="text-xs text-muted">{meta.label}</p>
          <Pill text={formatCurrency(holding.current_value)} />
          <Pill
            text={`${gain >= 0 ? '+' : '−'}${formatCurrency(Math.abs(gain))} (${gainPct.toFixed(1)}%)`}
          />
        </div>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
          <Pill text={`CAGR ${formatPct(metrics?.cagr)}`} />
          <Pill text={`XIRR ${formatPct(metrics?.xirr)}`} />
          {termPill ? <Pill text={termPill} /> : null}
          <Pill text={`Tax ${formatCurrency(metrics?.taxLiability ?? 0)}`} />
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <HoldingFormDialog
          holding={holding}
          trigger={
            <Button variant="ghost" size="sm" aria-label={`Edit ${holding.name}`}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          }
        />
        <Button
          variant="ghost"
          size="sm"
          className="text-muted hover:text-[var(--color-negative-600)]"
          disabled={deleteHolding.isPending}
          onClick={() => deleteHolding.mutate(holding.id)}
          aria-label={`Delete ${holding.name}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}

function PortfolioSkeleton() {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}><CardContent className="pt-4"><Skeleton className="h-8 w-5/6" /></CardContent></Card>
      ))}</div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">{Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}><CardContent className="pt-6"><Skeleton className="h-52" /></CardContent></Card>
      ))}</div>
      <Card>
        <CardContent>
          <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-12" />
          ))}</div>
        </CardContent>
      </Card>
    </div>
  )
}
