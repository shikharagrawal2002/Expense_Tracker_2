import type { Holding, HoldingTransaction, InvestmentType } from '@/features/investments/api'

/** Broad asset class a holding is taxed under — drives the STCG/LTCG estimate. */
export type AssetClass = 'equity' | 'debt' | 'gold' | 'crypto' | 'exempt' | 'other'

export const ASSET_CLASS_BY_TYPE: Record<InvestmentType, AssetClass> = {
  mutual_fund: 'equity',
  stock: 'equity',
  crypto: 'crypto',
  gold: 'gold',
  fd: 'debt',
  bond: 'debt',
  ppf: 'exempt',
  epf: 'exempt',
  nps: 'exempt',
  other: 'other',
}

export interface TaxRule {
  label: string
  /** Months after which the gain counts as long-term (0 = no LTCG concept). */
  longTermMonths: number
  longTermRate: number
  shortTermRate: number
  /** Crypto/VDAs are taxed at a flat rate regardless of how long you held. */
  flatRate?: number
  note: string
}

/** Indian tax treatment, FY 2025-26 (post-Jul-2024 rules). These are *estimates*
 *  for planning only — surcharge, cess, the ₹1.25 L equity LTCG exemption and the
 *  filer's actual slab rate are not modelled. */
export const TAX_RULES: Record<AssetClass, TaxRule> = {
  equity: {
    label: 'Equity',
    longTermMonths: 12,
    longTermRate: 0.125,
    shortTermRate: 0.2,
    note: '12.5% LTCG above ₹1.25 L/year, 20% STCG',
  },
  debt: {
    label: 'Debt',
    longTermMonths: 12,
    longTermRate: 0.125,
    shortTermRate: 0.3,
    note: 'Taxed at your slab — 30% assumed here',
  },
  gold: {
    label: 'Gold',
    longTermMonths: 24,
    longTermRate: 0.125,
    shortTermRate: 0.3,
    note: '12.5% LTCG after 24 months, else slab',
  },
  crypto: {
    label: 'Virtual digital asset',
    longTermMonths: 0,
    longTermRate: 0.3,
    shortTermRate: 0.3,
    flatRate: 0.3,
    note: 'Flat 30% on gains, no holding-period benefit',
  },
  exempt: {
    label: 'Exempt',
    longTermMonths: 0,
    longTermRate: 0,
    shortTermRate: 0,
    note: 'PPF/EPF/NPS — not taxed at accrual',
  },
  other: {
    label: 'Other',
    longTermMonths: 12,
    longTermRate: 0.125,
    shortTermRate: 0.3,
    note: '12.5% long-term, slab short-term',
  },
}

export type TaxTerm = 'long' | 'short' | 'flat' | 'exempt'

export function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth()) +
    (to.getDate() - from.getDate()) / 30
)
}
export interface HoldingMetrics {
  gain: number
  gainPct: number
  yearsHeld: number
  cagr: number | null
  xirr: number | null
  assetClass: AssetClass
  taxTerm: TaxTerm
  /** Estimated tax if the whole position were sold today. */
  taxLiability: number
  taxRate: number
  rank: number | null
  peers: number
}

/** XIRR via bisection — the money-weighted return of the actual cashflow dates.
 *  Returns null when there aren't at least two flows or no sign change exists. */
export function xirr(flows: Array<{ date: Date; amount: number }>): number | null {
  if (flows.length < 2) return null
  const sorted = [...flows].sort((a, b) => a.date.getTime() - b.date.getTime())
  const start = sorted[0].date.getTime()
  if (!sorted.some((f) => f.amount > 0) || !sorted.some((f) => f.amount < 0)) return null

  const npv = (rate: number) =>
    sorted.reduce((sum, f) => {
      const years = (f.date.getTime() - start) / (365 * 24 * 60 * 60 * 1000)
      return sum + f.amount / Math.pow(1 + rate, years)
    }, 0)

  let low = -0.9999
  let high = 10
  let fLow = npv(low)
  if (Number.isNaN(fLow) || fLow * npv(high) > 0) return null

  for (let i = 0; i < 120; i++) {
    const mid = (low + high) / 2
    const fMid = npv(mid)
    if (Math.abs(fMid) < 1e-7) return mid
    if (fLow * fMid < 0) {
      high = mid
    } else {
      low = mid
      fLow = fMid
    }
  }
  return (low + high) / 2
}

/** Builds the cashflow series used by XIRR: buys are outflows, redemptions and
 *  dividends inflows, plus today's valuation as the terminal inflow. */
function buildFlows(
  holding: Holding,
  transactions: HoldingTransaction[] | undefined,
  now: Date,
): Array<{ date: Date; amount: number }> {
  const flows: Array<{ date: Date; amount: number }> = []

  for (const t of transactions ?? []) {
    const date = safeDate(t.transaction_date)
    if (!date) continue
    const outflow = t.type === 'buy' || t.type === 'sip' || t.type === 'switch_in'
    const amount = Math.abs(Number(t.amount) || 0)
    if (amount === 0) continue
    flows.push({ date, amount: outflow ? -amount : amount })
  }

  if (flows.length === 0) {
    flows.push({ date: safeDate(holding.purchased_at) ?? now, amount: -holding.invested_amount })
  }

  if (holding.current_value > 0) flows.push({ date: now, amount: holding.current_value })
  return flows
}

export function computeMetrics(
  holding: Holding,
  transactions?: HoldingTransaction[],
  now: Date = new Date(),
): HoldingMetrics {
  const invested = Number(holding.invested_amount) || 0
  const current = Number(holding.current_value) || 0
  const gain = current - invested
  const gainPct = invested > 0 ? (gain / invested) * 100 : 0

  const startDate = safeDate(transactions?.[0]?.transaction_date) ?? safeDate(holding.purchased_at) ?? now
  const yearsHeld = Math.max((now.getTime() - startDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000), 0)
  const heldMonths = monthsBetween(startDate, now)

  const cagr =
    invested > 0 && current > 0
      ? yearsHeld >= 0.5
        ? Math.pow(current / invested, 1 / yearsHeld) - 1
        : gainPct / 100
      : null

  const annualised = xirr(buildFlows(holding, transactions, now))

  const assetClass = ASSET_CLASS_BY_TYPE[holding.type] ?? 'other'
  const rule = TAX_RULES[assetClass]

  let taxTerm: TaxTerm
  if (rule.flatRate !== undefined) taxTerm = 'flat'
  else if (rule.longTermRate === 0 && rule.shortTermRate === 0) taxTerm = 'exempt'
  else taxTerm = heldMonths >= rule.longTermMonths ? 'long' : 'short'

  const taxRate =
    taxTerm === 'flat'
      ? rule.flatRate ?? 0
      : taxTerm === 'long'
        ? rule.longTermRate
        : taxTerm === 'short'
          ? rule.shortTermRate
          : 0
  const taxLiability = gain > 0 ? gain * taxRate : 0

  return {
    gain,
    gainPct,
    yearsHeld,
    cagr: cagr !== null && Number.isFinite(cagr) ? cagr : null,
    xirr: annualised !== null && Number.isFinite(annualised) ? annualised : null,
    assetClass,
    taxTerm,
    taxLiability,
    taxRate,
    rank: null,
    peers: 0,
  }
}

/** Ranks each holding against its peers *of the same investment type* by return
 *  %, which is what "how does this fund stack up" usually means. */
export function rankByPeer(
  holdings: Holding[],
  metrics: Map<string, HoldingMetrics>,
): Map<string, { rank: number; peers: number }> {
  const byType = new Map<InvestmentType, Holding[]>()
  for (const h of holdings) {
    const list = byType.get(h.type) ?? []
    list.push(h)
    byType.set(h.type, list)
  }

  const out = new Map<string, { rank: number; peers: number }>()
  for (const list of byType.values()) {
    const ordered = [...list].sort((a, b) => (metrics.get(b.id)?.gainPct ?? 0) - (metrics.get(a.id)?.gainPct ?? 0))
    ordered.forEach((h, i) => out.set(h.id, { rank: i + 1, peers: ordered.length }))
  }
  return out
}

export interface TaxSummary {
  shortTermTax: number
  longTermTax: number
  flatTax: number
  exemptGains: number
  totalTax: number
  shortTermGains: number
  longTermGains: number
}

export function summariseTax(items: Array<{ metrics: HoldingMetrics; gain: number }>): TaxSummary {
  const summary: TaxSummary = {
    shortTermTax: 0,
    longTermTax: 0,
    flatTax: 0,
    exemptGains: 0,
    totalTax: 0,
    shortTermGains: 0,
    longTermGains: 0,
  }

  for (const { metrics, gain } of items) {
    if (metrics.taxTerm === 'short') {
      summary.shortTermTax += metrics.taxLiability
      if (gain > 0) summary.shortTermGains += gain
    } else if (metrics.taxTerm === 'long') {
      summary.longTermTax += metrics.taxLiability
      if (gain > 0) summary.longTermGains += gain
    } else if (metrics.taxTerm === 'flat') {
      summary.flatTax += metrics.taxLiability
    } else {
      summary.exemptGains += Math.max(gain, 0)
    }
  }

  summary.totalTax = summary.shortTermTax + summary.longTermTax + summary.flatTax
  return summary
}

export function safeDate(value: string | null | undefined): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function formatPct(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${(value * 100).toFixed(digits)}%`
}
