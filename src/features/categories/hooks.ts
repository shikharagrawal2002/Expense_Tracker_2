import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase/client'
import type { Category, CategoryKind } from '@/lib/supabase/types'

const CATEGORIES_KEY = ['categories'] as const

async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase.from('categories').select('*').order('sort_order', { ascending: true })
  if (error) throw error
  return data as Category[]
}

export function useCategories() {
  return useQuery({ queryKey: CATEGORIES_KEY, queryFn: fetchCategories })
}

export interface NewCategory {
  name: string
  kind: CategoryKind
  icon: string
  color: string
  parent_id?: string | null
}

async function createCategory(input: NewCategory): Promise<Category> {
  const { data: userData } = await supabase.auth.getUser()
  const userId = userData.user?.id
  if (!userId) throw new Error('Not authenticated')

  const { data, error } = await supabase
    .from('categories')
    .insert({ ...input, user_id: userId })
    .select('*')
    .single()
  if (error) throw error
  return data as Category
}

async function deleteCategory(id: string): Promise<void> {
  const { error } = await supabase.from('categories').delete().eq('id', id)
  if (error) throw error
}

export function useCreateCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: NewCategory) => createCategory(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteCategory(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: CATEGORIES_KEY })
      const previous = queryClient.getQueryData<Category[]>(CATEGORIES_KEY)
      queryClient.setQueryData<Category[]>(CATEGORIES_KEY, (old) => old?.filter((c) => c.id !== id))
      return { previous }
    },
    onError: (_err, _id, context) => {
      if (context?.previous) queryClient.setQueryData(CATEGORIES_KEY, context.previous)
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: CATEGORIES_KEY }),
  })
}

