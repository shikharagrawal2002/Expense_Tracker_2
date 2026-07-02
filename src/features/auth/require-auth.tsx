import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/use-auth'
import { Sparkles } from 'lucide-react'

export function RequireAuth() {
  const { session, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <Sparkles className="h-5 w-5 text-[var(--color-brand-500)] animate-pulse" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <Outlet />
}
