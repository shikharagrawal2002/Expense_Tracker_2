import { Sparkles } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'

const INSIGHTS = [
  "You're spending 18% more on Dining Out than your 3-month average — mostly weekday lunches.",
  'At this savings rate, your Emergency Fund goal will be fully funded by November 2026.',
  'HDFC Credit Card utilization crossed 28% — paying down ₹15,000 before the statement date keeps your score healthy.',
]

export function AiInsightsPanel() {
  return (
    <Card className="bg-gradient-to-br from-[var(--color-brand-50)] to-transparent dark:from-[var(--color-brand-500)]/10 dark:to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
          <Sparkles className="h-3.5 w-3.5" />
          AI insights
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {INSIGHTS.map((insight, i) => (
          <p key={i} className="text-sm leading-relaxed">
            {insight}
          </p>
        ))}
        <p className="text-xs text-muted pt-1">
          Generated from your last 90 days of activity. Connect an LLM provider in Settings to enable live insights.
        </p>
      </CardContent>
    </Card>
  )
}
