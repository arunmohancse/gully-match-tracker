import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { paymentInstructionsText } from '@/utils/upi'
import { communityService, type PaymentSettings } from '@/services/communityService'

/** Payment settings (how-to-pay text, UPI id, payee name) for a community. Only requested for logged-in users (the database hides them from visitors). */
export function usePaymentSettings(communityId: string | undefined) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['community', 'payment-settings', communityId],
    queryFn: () => communityService.getPaymentSettings(communityId!),
    enabled: !!communityId && !!session,
    staleTime: 60_000,
  })
}

/** The ready-to-show how-to-pay text: the UPI id (if set) followed by the free-text instructions. */
export function usePaymentInstructions(communityId: string | undefined) {
  const query = usePaymentSettings(communityId)
  return { ...query, data: query.data ? paymentInstructionsText(query.data) : undefined }
}

export function useSavePaymentSettings(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (settings: PaymentSettings) => communityService.savePaymentSettings(communityId, settings),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community'] }),
  })
}
