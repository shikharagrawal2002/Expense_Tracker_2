import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/use-auth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'

function useOnboarded() {
  return useQuery({
    queryKey: ['onboarded'],
    queryFn: async (): Promise<boolean> => {
      const { data: userData } = await supabase.auth.getUser()
      if (!userData.user?.id) return true
      const { data, error } = await supabase
        .from('profiles')
        .select('onboarded_at')
        .eq('id', userData.user.id)
        .single()
      if (error) return true // If the column doesn't exist yet, don't block
      return Boolean(data?.onboarded_at)
    },
    staleTime: 60_000,
  })
}

export function RequireAuth() {
  const { session, isLoading } = useAuth()
  const location = useLocation()
  const { data: onboarded, isLoading: onboardedLoading } = useOnboarded()

  if (isLoading || onboardedLoading) {
    return (
      <div className="flex h-dvh w-full items-center justify-center">
        <Sparkles className="h-5 w-5 text-[var(--color-brand-500)] animate-pulse" />
      </div>
    )
  }

  if (!session) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Force onboarding on first login until complete
  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}