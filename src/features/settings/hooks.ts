import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'

export interface Profile {
  id: string
  full_name: string | null
  base_currency: string
}

async function fetchProfile(): Promise<Profile | null> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) return null

  const { data, error } = await supabase.from('profiles').select('id, full_name, base_currency').eq('id', userId).single()
  if (error) throw error
  return data as Profile
}

async function updateProfile(patch: Partial<Pick<Profile, 'full_name' | 'base_currency'>>): Promise<void> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { error } = await supabase.from('profiles').update(patch).eq('id', userId)
  if (error) throw error
}

export function useProfile() {
  return useQuery({ queryKey: ['profile'], queryFn: fetchProfile })
}

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (patch: Partial<Pick<Profile, 'full_name' | 'base_currency'>>) => updateProfile(patch),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['profile'] }),
  })
}
