import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchEmailIngestAddresses,
  createEmailIngestAddress,
  setEmailIngestActive,
  deleteEmailIngestAddress,
  fetchEmailIngestLogs,
} from '@/features/email/api'

const EMAIL_ADDRESSES_KEY = ['email-ingest-addresses'] as const
const EMAIL_LOGS_KEY = ['email-ingest-logs'] as const

export function useEmailIngestAddresses() {
  return useQuery({ queryKey: EMAIL_ADDRESSES_KEY, queryFn: fetchEmailIngestAddresses })
}

export function useCreateEmailIngestAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => createEmailIngestAddress(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMAIL_ADDRESSES_KEY }),
  })
}

export function useSetEmailIngestActive() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => setEmailIngestActive(id, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMAIL_ADDRESSES_KEY }),
  })
}

export function useDeleteEmailIngestAddress() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteEmailIngestAddress(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: EMAIL_ADDRESSES_KEY }),
  })
}

export function useEmailIngestLogs() {
  return useQuery({ queryKey: EMAIL_LOGS_KEY, queryFn: fetchEmailIngestLogs })
}