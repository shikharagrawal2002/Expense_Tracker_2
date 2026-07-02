import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Loader2, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Label, FormError } from '@/components/ui/input'
import { useAuth } from '@/features/auth/use-auth'
import { AuthShell } from '@/features/auth/login-page'

const schema = z.object({
  fullName: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
})
type FormValues = z.infer<typeof schema>

export function SignupPage() {
  const { session, signUpWithPassword } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({ resolver: zodResolver(schema) })

  if (session) return <Navigate to="/dashboard" replace />

  const onSubmit = async (values: FormValues) => {
    setServerError(null)
    const { error } = await signUpWithPassword(values.email, values.password, values.fullName)
    if (error) {
      setServerError(error)
      return
    }
    setSubmitted(true)
  }

  if (submitted) {
    return (
      <AuthShell>
        <div className="text-center py-4">
          <CheckCircle2 className="h-10 w-10 text-[var(--color-positive-500)] mx-auto mb-3" />
          <h1 className="font-display text-lg font-semibold mb-1">Check your inbox</h1>
          <p className="text-sm text-muted">
            We sent a confirmation link to finish setting up your account.
          </p>
          <Button variant="secondary" className="mt-5 w-full" onClick={() => navigate('/login')}>
            Back to sign in
          </Button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell>
      <h1 className="font-display text-xl font-semibold mb-1">Create your account</h1>
      <p className="text-sm text-muted mb-6">Start tracking your money in minutes.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <Label htmlFor="fullName">Full name</Label>
          <Input id="fullName" placeholder="Aarav Shah" {...register('fullName')} />
          <FormError message={errors.fullName?.message} />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" placeholder="you@example.com" {...register('email')} />
          <FormError message={errors.email?.message} />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" placeholder="At least 6 characters" {...register('password')} />
          <FormError message={errors.password?.message} />
        </div>
        {serverError && <FormError message={serverError} />}
        <Button type="submit" className="w-full" disabled={isSubmitting}>
          {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>

      <p className="text-sm text-muted text-center mt-6">
        Already have an account?{' '}
        <Link to="/login" className="text-[var(--color-brand-500)] font-medium hover:underline">
          Sign in
        </Link>
      </p>
    </AuthShell>
  )
}
