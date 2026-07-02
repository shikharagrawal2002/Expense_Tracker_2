import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { useAuth } from '@/features/auth/use-auth'

const schema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormValues = z.infer<typeof schema>

export function LoginPage() {
  const { session, signInWithPassword, signInWithOAuth } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [serverError, setServerError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (session) {
    const from = (location.state as { from?: Location })?.from?.pathname || '/dashboard'
    return <Navigate to={from} replace />
  }

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const { error } = await signInWithPassword(values.email, values.password)
    if (error) {
      setServerError(error)
      return
    }
    navigate('/dashboard', { replace: true })
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-semibold mb-1">Welcome back</h1>
      <p className="text-sm text-muted mb-6">Sign in to your Ledger account.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          <FormError message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="••••••••" {...register('password')} />
          <FormError message={errors.password?.message} />
        </div>
        {serverError && <FormError message={serverError} />}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Sign in
        </Button>
      </form>

      <div className="flex items-center gap-3 my-5">
        <div className="h-px flex-1 bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)]" />
        <span className="text-xs text-muted">or</span>
        <div className="h-px flex-1 bg-[var(--color-border-light)] dark:bg-[var(--color-border-dark)]" />
      </div>

      <div className="space-y-2">
        <Button variant="outline" className="w-full" onClick={() => signInWithOAuth('google')}>
          <GoogleIcon className="h-4 w-4" />
          Continue with Google
        </Button>
        <Button variant="outline" className="w-full" onClick={() => signInWithOAuth('github')}>
          <GithubIcon className="h-4 w-4" />
          Continue with GitHub
        </Button>
      </div>

      <p className="text-sm text-muted text-center mt-6">
        Don't have an account?{' '}
        <Link to="/signup" className="text-[var(--color-brand-500)] font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </AuthShell>
  )
}

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh w-full flex items-center justify-center px-4 bg-[var(--color-bg-light)] dark:bg-[var(--color-bg-dark)]">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-8">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-brand-500)]">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="font-display font-semibold text-lg">Ledger</span>
        </div>
        <div className="surface border border-hairline rounded-2xl p-6 shadow-sm">{children}</div>
      </div>
    </div>
  )
}

function GithubIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.57.1.78-.25.78-.55 0-.27-.01-1.16-.02-2.11-3.2.7-3.88-1.36-3.88-1.36-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.08-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.21-1.49 3.18-1.18 3.18-1.18.63 1.59.23 2.76.11 3.05.74.8 1.19 1.82 1.19 3.08 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14 0 1.54-.01 2.79-.01 3.17 0 .3.21.66.79.55A10.51 10.51 0 0 0 23.5 12c0-6.35-5.15-11.5-11.5-11.5Z" />
    </svg>
  )
}

function GoogleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
