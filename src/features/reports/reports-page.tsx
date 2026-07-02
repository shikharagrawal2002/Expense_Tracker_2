import { useState } from 'react'
import { Download, FileDown } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input, Label } from '@/components/ui/input'
import { formatCurrency } from '@/lib/utils'
import { supabase } from '@/lib/supabase/client'
import { useMonthlyTrend } from '@/features/analytics/hooks'

function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return ''
  const headers = Object.keys(rows[0])
  const escape = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`
  const lines = [headers.join(','), ...rows.map((row) => headers.map((h) => escape(row[h])).join(','))]
  return lines.join('\n')
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function ReportsPage() {
  const [from, setFrom] = useState(() => {
    const d = new Date()
    d.setDate(1)
    return d.toISOString().slice(0, 10)
  })
  const [to, setTo] = useState(() => new Date().toISOString().slice(0, 10))
  const [isExporting, setIsExporting] = useState(false)
  const { data: trend } = useMonthlyTrend(6)

  const exportCsv = async () => {
    setIsExporting(true)
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('occurred_at, type, amount, currency, notes, account:accounts(name), category:categories(name)')
        .gte('occurred_at', from)
        .lte('occurred_at', to + 'T23:59:59')
        .order('occurred_at', { ascending: true })
      if (error) throw error

      const rows = (data as unknown as Array<{
        occurred_at: string
        type: string
        amount: number
        currency: string
        notes: string | null
        account: { name: string } | null
        category: { name: string } | null
      }>).map((t) => ({
        date: t.occurred_at.slice(0, 10),
        type: t.type,
        account: t.account?.name ?? '',
        category: t.category?.name ?? '',
        amount: t.amount,
        currency: t.currency,
        notes: t.notes ?? '',
      }))

      downloadFile(`transactions_${from}_to_${to}.csv`, toCsv(rows), 'text/csv')
    } finally {
      setIsExporting(false)
    }
  }

  const latestMonth = trend?.[trend.length - 1]

  return (
    <div className="max-w-[800px] space-y-6">
      <h1 className="font-display text-2xl font-semibold">Reports</h1>

      {latestMonth && (
        <Card>
          <CardHeader>
            <CardTitle>This month at a glance</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted">Income</p>
              <p className="font-display text-lg font-semibold num text-[var(--color-positive-600)]">
                {formatCurrency(latestMonth.income)}
              </p>
            </div>
            <div>
              <p className="text-xs text-muted">Expense</p>
              <p className="font-display text-lg font-semibold num">{formatCurrency(latestMonth.expense)}</p>
            </div>
            <div>
              <p className="text-xs text-muted">Net</p>
              <p className="font-display text-lg font-semibold num">
                {formatCurrency(latestMonth.income - latestMonth.expense)}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Export transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="from">From</Label>
              <Input id="from" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <Button onClick={exportCsv} disabled={isExporting}>
            {isExporting ? <FileDown className="h-4 w-4 animate-bounce" /> : <Download className="h-4 w-4" />}
            Export CSV
          </Button>
          <p className="text-xs text-muted">Downloads a CSV of transactions in the selected date range — open it in Excel or Sheets for a custom monthly/yearly report.</p>
        </CardContent>
      </Card>
    </div>
  )
}
