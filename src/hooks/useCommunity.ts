import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { communityService } from '@/services/communityService'

/** Payment instructions for a community. Only requested for logged-in users (the database hides it from visitors). */
export function usePaymentInstructions(communityId: string | undefined) {
  const { session } = useAuth()
  return useQuery({
    queryKey: ['community', 'payment-instructions', communityId],
    queryFn: () => communityService.getPaymentInstructions(communityId!),
    enabled: !!communityId && !!session,
    staleTime: 60_000,
  })
}

export function useSavePaymentInstructions(communityId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (text: string) => communityService.savePaymentInstructions(communityId, text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['community'] }),
  })
}
