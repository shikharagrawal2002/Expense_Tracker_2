import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Sparkles, RefreshCw, Loader2 } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { fetchLatestAiInsights, refreshAiInsights } from '@/features/dashboard/api'

const AI_INSIGHTS_KEY = ['ai-insights'] as const

function useAiInsights() {
  return useQuery({ queryKey: AI_INSIGHTS_KEY, queryFn: fetchLatestAiInsights })
}

function useRefreshAiInsights() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => refreshAiInsights(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AI_INSIGHTS_KEY }),
  })
}

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-[var(--color-negative-500)]/50 bg-[var(--color-negative-500)]/10 text-[var(--color-negative-700)] dark:text-[var(--color-negative-400)]',
  warning: 'border-[var(--color-warning-500)]/50 bg-[var(--color-warning-500)]/10 text-[var(--color-warning-700)] dark:text-[var(--color-warning-400)]',
  info: 'border-[var(--color-brand-500)]/40 bg-[var(--color-brand-50)] text-[var(--color-brand-700)] dark:bg-[var(--color-brand-500)]/10 dark:text-[var(--color-brand-300)]',
}

export function AiInsightsPanel() {
  const { data: row, isLoading, isError } = useAiInsights()
  const refresh = useRefreshAiInsights()

  return (
    <Card className="bg-gradient-to-br from-[var(--color-brand-50)] to-transparent dark:from-[var(--color-brand-500)]/10 dark:to-transparent">
      <CardHeader>
        <CardTitle className="flex items-center gap-1.5 text-[var(--color-brand-600)] dark:text-[var(--color-brand-300)]">
          <Sparkles className="h-3.5 w-3.5" />
          AI insights
        </CardTitle>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refresh.mutate()}
          disabled={refresh.isPending}
          aria-label="Refresh insights"
        >
          {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading && (
          <div className="space-y-2">
            <div className="h-4 w-4/5 rounded bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            <div className="h-4 w-3/4 rounded bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)] animate-pulse" />
            <div className="h-4 w-5/6 rounded bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)] animate-pulse" />
          </div>
        )}

        {!isLoading && isError && (
          <div className="rounded-lg border border-[var(--color-negative-500)]/40 bg-[var(--color-negative-500)]/10 p-3 text-sm text-[var(--color-negative-600)]">
            Couldn't load insights. Check that the 0021 migration is applied.
          </div>
        )}

        {!isLoading && !isError && !row && (
          <div className="text-sm text-muted space-y-2">
            <p>No insights generated yet. Insights are generated nightly — or hit refresh to run one now (a few per day).</p>
            <Button size="sm" onClick={() => refresh.mutate()} disabled={refresh.isPending}>
              {refresh.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              Generate insights
            </Button>
          </div>
        )}

        {!isLoading && !isError && row && row.insights.length === 0 && (
          <div className="text-sm text-muted">
            Insights are warming up — they'll appear after tonight's run, or hit Refresh to generate now.
          </div>
        )}

        {!isLoading && !isError && row && row.insights.length > 0 && (
          <div className="space-y-2.5">
            {row.insights.map((insight, i) => (
              <div
                key={i}
                className={cn('rounded-lg border px-3 py-2.5 space-y-0.5', SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info)}
              >
                <p className="text-sm font-semibold">{insight.title}</p>
                <p className="text-sm leading-relaxed opacity-90">{insight.detail}</p>
                {insight.deepLink && (
                  <Link
                    to={insight.deepLink}
                    className="inline-block mt-0.5 text-xs font-medium underline underline-offset-2 opacity-80 hover:opacity-100"
                  >
                    View →
                  </Link>
                )}
              </div>
            ))}
            <p className="text-xs text-muted pt-1">
              Generated {new Date(row.generated_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
              {row.model ? ` · ${row.model}` : ''}
            </p>
          </div>
        )}

        {refresh.isError && (
          <p className="text-xs text-[var(--color-negative-600)]">
            {(refresh.error as Error).message}
          </p>
        )}
      </CardContent>
    </Card>
  )
}