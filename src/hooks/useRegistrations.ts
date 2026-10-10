import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { registrationService } from '@/services/registrationService'
import type { ListType } from '@/types/domain'

export function useMyRegistration(matchId: string | undefined) {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: ['registrations', 'mine', matchId, userId],
    queryFn: () => registrationService.getMine(matchId!, userId!),
    enabled: !!matchId && !!userId,
  })
}

export function useMyRegistrations() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: ['registrations', 'list', userId],
    queryFn: () => registrationService.listMine(userId!),
    enabled: !!userId,
  })
}

/** Overdue payments that stop the player registering. Shares the 'registrations' key prefix, so payment changes refresh it. */
export function usePaymentBlock() {
  const userId = useAuth().session?.user.id
  return useQuery({
    queryKey: ['registrations', 'payment-block', userId],
    queryFn: () => registrationService.paymentBlock(),
    enabled: !!userId,
  })
}

export function useRoster(matchId: string | undefined, enabled: boolean) {
  return useQuery({
    queryKey: ['registrations', 'roster', matchId],
    queryFn: () => registrationService.roster(matchId!),
    enabled: !!matchId && enabled,
  })
}

export function useMatchCounts(matchIds: string[]) {
  const key = [...matchIds].sort().join(',')
  return useQuery({
    queryKey: ['counts', key],
    queryFn: () => registrationService.counts(matchIds),
    enabled: matchIds.length > 0,
  })
}

function useInvalidateRegistrationData() {
  const qc = useQueryClient()
  return () =>
    Promise.all([
      qc.invalidateQueries({ queryKey: ['registrations'] }),
      qc.invalidateQueries({ queryKey: ['counts'] }),
      qc.invalidateQueries({ queryKey: ['matches'] }),
    ])
}

export function useCancelRegistration() {
  const invalidate = useInvalidateRegistrationData()
  return useMutation({
    mutationFn: (registrationId: string) => registrationService.cancel(registrationId),
    onSettled: invalidate,
  })
}

export function useAdminRegistrations(matchId: string | undefined) {
  return useQuery({
    queryKey: ['registrations', 'admin', matchId],
    queryFn: () => registrationService.adminList(matchId!),
    enabled: !!matchId,
  })
}

export function useAdminMove() {
  const invalidate = useInvalidateRegistrationData()
  return useMutation({
    mutationFn: (args: { registrationId: string; target: ListType; swapWith?: string }) =>
      registrationService.adminMove(args.registrationId, args.target, args.swapWith),
    onSettled: invalidate,
  })
}

export function useRegister(matchId: string) {
  const qc = useQueryClient()
  const userId = useAuth().session?.user.id
  return useMutation({
    mutationFn: () => registrationService.register(matchId, userId!),
    // Refetch on success or failure: after a timeout the server may have committed anyway.
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['registrations'] }),
        qc.invalidateQueries({ queryKey: ['counts'] }),
        qc.invalidateQueries({ queryKey: ['matches'] }),
      ]),
  })
}
