import { AlertTriangle } from 'lucide-react'

export function ConfigMissingScreen() {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center px-4 bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]">
      <div className="max-w-md w-full surface border border-hairline rounded-2xl p-6 text-center">
        <div className="h-12 w-12 rounded-full bg-[var(--color-warning-500)]/15 flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="h-5 w-5 text-[var(--color-warning-500)]" />
        </div>
        <h1 className="font-display text-lg font-semibold mb-2">Supabase isn't configured</h1>
        <p className="text-sm text-muted mb-4">
          This build is missing <code className="num text-xs surface-2 px-1 py-0.5 rounded">VITE_SUPABASE_URL</code> and{' '}
          <code className="num text-xs surface-2 px-1 py-0.5 rounded">VITE_SUPABASE_ANON_KEY</code>.
        </p>
        <div className="text-left text-sm surface-2 rounded-lg p-3 space-y-1.5">
          <p className="font-medium">To fix:</p>
          <p className="text-muted">
            Local dev: copy <code className="num text-xs">.env.example</code> to{' '}
            <code className="num text-xs">.env.local</code> and fill in your Supabase project's URL and anon key.
          </p>
          <p className="text-muted">
            GitHub Pages: add both as repo secrets under Settings → Secrets and variables → Actions, then re-run the
            deploy workflow.
          </p>
          <p className="text-muted">Vercel: add both as Environment Variables in the project settings, then redeploy.</p>
        </div>
      </div>
    </div>
  )
}
