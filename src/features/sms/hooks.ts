import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchPendingSms,
  fetchSmsHistory,
  confirmSmsTransaction,
  skipSmsTransaction,
  fetchSmsSources,
  createSmsSource,
  deleteSmsSource,
  generateSmsApiKey,
  fetchSmsApiKey,
} from '@/features/sms/api'

const PENDING_SMS_KEY = ['sms-pending'] as const
const SMS_HISTORY_KEY = ['sms-history'] as const
const SMS_SOURCES_KEY = ['sms-sources'] as const
const SMS_API_KEY_KEY = ['sms-api-key'] as const

export function usePendingSms() {
  return useQuery({ queryKey: PENDING_SMS_KEY, queryFn: fetchPendingSms })
}

export function useSmsHistory() {
  return useQuery({ queryKey: SMS_HISTORY_KEY, queryFn: fetchSmsHistory })
}

export function useConfirmSms() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ smsId, accountId, categoryId }: { smsId: string; accountId: string; categoryId?: string }) =>
      confirmSmsTransaction(smsId, accountId, categoryId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_SMS_KEY })
      queryClient.invalidateQueries({ queryKey: SMS_HISTORY_KEY })
      queryClient.invalidateQueries({ queryKey: ['transactions'] })
      queryClient.invalidateQueries({ queryKey: ['accounts'] })
    },
  })
}

export function useSkipSms() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (smsId: string) => skipSmsTransaction(smsId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PENDING_SMS_KEY })
      queryClient.invalidateQueries({ queryKey: SMS_HISTORY_KEY })
    },
  })
}

export function useSmsSources() {
  return useQuery({ queryKey: SMS_SOURCES_KEY, queryFn: fetchSmsSources })
}

export function useCreateSmsSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { sender_phone: string; bank_name: string; upi_vpa?: string | null }) =>
      createSmsSource(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_SOURCES_KEY }),
  })
}

export function useDeleteSmsSource() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteSmsSource(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_SOURCES_KEY }),
  })
}

export function useSmsApiKey() {
  return useQuery({ queryKey: SMS_API_KEY_KEY, queryFn: fetchSmsApiKey })
}

export function useGenerateSmsApiKey() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => generateSmsApiKey(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SMS_API_KEY_KEY }),
  })
}