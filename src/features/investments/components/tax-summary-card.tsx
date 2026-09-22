import { Landmark, Info } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'
import { TAX_RULES, formatPct, type TaxSummary } from '@/features/investments/metrics'

/** Estimated tax if every position were sold today, split into the buckets that
 *  actually matter for filing: short-term, long-term and flat-rate (crypto). */
export function TaxSummaryCard({ tax }: { tax: TaxSummary }) {
  const rows = [
    {
      label: 'Short-term',
      gains: tax.shortTermGains,
      amount: tax.shortTermTax,
      hint: `${formatPct(TAX_RULES.equity.shortTermRate, 0)} on equity held under ${TAX_RULES.equity.longTermMonths} months`,
      tone: 'var(--color-negative-600)',
    },
    {
      label: 'Long-term',
      gains: tax.longTermGains,
      amount: tax.longTermTax,
      hint: `${formatPct(TAX_RULES.equity.longTermRate, 0)} on equity held over ${TAX_RULES.equity.longTermMonths} months`,
      tone: 'var(--color-warning-500)',
    },
    {
      label: 'Crypto / VDA',
      gains: tax.flatTax > 0 ? tax.flatTax / 0.3 : 0,
      amount: tax.flatTax,
      hint: TAX_RULES.crypto.note,
      tone: 'var(--color-negative-600)',
    },
  ].filter((r) => r.amount > 0 || r.gains > 0)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Estimated tax if sold today</CardTitle>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted num">
          <Landmark className="h-3.5 w-3.5" />
          {formatCurrency(tax.totalTax)}
        </span>
      </CardHeader>
      <CardContent className="pt-2 space-y-3">
        {rows.length === 0 && <p className="text-sm text-muted">No taxable gains in this portfolio right now.</p>}

        {rows.map((row) => (
          <div key={row.label} className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: row.tone }} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">
                {row.label}{' '}
                {row.gains > 0 && <span className="text-muted font-normal num">on {formatCurrency(row.gains)}</span>}
              </p>
              <p className="text-xs text-muted truncate">{row.hint}</p>
            </div>
            <p className="text-sm font-medium num shrink-0" style={{ color: row.tone }}>
              {formatCurrency(row.amount)}
            </p>
          </div>
        ))}

        {tax.exemptGains > 0 && (
          <div className="flex items-start gap-3">
            <span className="mt-1.5 h-2 w-2 rounded-full shrink-0 bg-[var(--color-positive-500)]" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">Exempt <span className="text-muted font-normal num">on {formatCurrency(tax.exemptGains)}</span></p>
              <p className="text-xs text-muted">PPF / EPF / NPS gains aren't taxed at accrual</p>
            </div>
            <p className="text-sm font-medium num shrink-0 text-[var(--color-positive-600)]">{formatCurrency(0)}</p>
          </div>
        )}

        <div className="flex items-start gap-1.5 pt-3 border-t border-hairline text-xs text-muted">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <p>
            Estimate only — assumes a 30% slab for debt, and ignores cess, surcharge and the ₹1.25 L annual equity LTCG
            exemption.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}