import { useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/features/auth/use-auth'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import { Sparkles } from 'lucide-react'
import { AppLock } from '@/components/layout/app-lock'

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
  const { session, isLoading, isEncryptionUnlocked } = useAuth()
  const location = useLocation()
  const { data: onboarded, isLoading: onboardedLoading } = useOnboarded()
  const [lockDismissed, setLockDismissed] = useState(false)

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

  // On session restore (page refresh / app relaunch), if the encryption key
  // isn't already unlocked in memory, show the AppLock screen until the user
  // enters their security PIN. No sensitive data is rendered underneath.
  if (!isEncryptionUnlocked && !lockDismissed && session.user) {
    return (
      <>
        <AppLock userId={session.user.id} onUnlocked={() => setLockDismissed(true)} />
        <Outlet />
      </>
    )
  }

  // Force onboarding on first login until complete
  if (!onboarded && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return <Outlet />
}