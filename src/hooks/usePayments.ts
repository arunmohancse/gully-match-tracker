import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { expenseService, type ExpenseInput } from '@/services/expenseService'
import { paymentService, type SetPaymentInput } from '@/services/paymentService'
import { playerService } from '@/services/playerService'
import type { Role } from '@/types/domain'

export function useFinancials(matchIds: string[], enabled = true) {
  const key = [...matchIds].sort().join(',')
  return useQuery({
    queryKey: ['financials', key],
    queryFn: () => paymentService.financials(matchIds),
    enabled: enabled && matchIds.length > 0,
  })
}

export function useSetPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: SetPaymentInput) => paymentService.setPayment(input),
    onSettled: () =>
      Promise.all([qc.invalidateQueries({ queryKey: ['registrations'] }), qc.invalidateQueries({ queryKey: ['financials'] })]),
  })
}

export function useFinalizeShares() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { matchId: string; step: number }) => paymentService.finalizeShares(args.matchId, args.step),
    onSettled: () =>
      Promise.all([
        qc.invalidateQueries({ queryKey: ['registrations'] }),
        qc.invalidateQueries({ queryKey: ['financials'] }),
        qc.invalidateQueries({ queryKey: ['audit'] }),
      ]),
  })
}

export function useExpenses(matchId: string | undefined) {
  return useQuery({ queryKey: ['expenses', matchId], queryFn: () => expenseService.list(matchId!), enabled: !!matchId })
}

export function useSaveExpense(matchId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id?: string; input: ExpenseInput }) =>
      args.id ? expenseService.update(args.id, args.input) : expenseService.create(matchId, args.input),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['expenses'] }), qc.invalidateQueries({ queryKey: ['financials'] })]),
  })
}

export function useDeleteExpense() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => expenseService.remove(id),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['expenses'] }), qc.invalidateQueries({ queryKey: ['financials'] })]),
  })
}

export function usePlayers() {
  return useQuery({ queryKey: ['players'], queryFn: () => playerService.list() })
}

export function useSetRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { userId: string; role: Role }) => playerService.setRole(args.userId, args.role),
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['players'] }), qc.invalidateQueries({ queryKey: ['audit'] })]),
  })
}

function usePlayerMutation<TArgs>(fn: (args: TArgs) => Promise<void>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSettled: () => Promise.all([qc.invalidateQueries({ queryKey: ['players'] }), qc.invalidateQueries({ queryKey: ['audit'] })]),
  })
}

export function useSetStatus() {
  return usePlayerMutation((a: { userId: string; status: 'ACTIVE' | 'BLOCKED' }) => playerService.setStatus(a.userId, a.status))
}

export function useSetTempPassword() {
  return usePlayerMutation((a: { userId: string; password: string }) => playerService.setTempPassword(a.userId, a.password))
}

export function useSetPasswordReset() {
  return usePlayerMutation((a: { userId: string; enabled: boolean }) => playerService.setPasswordReset(a.userId, a.enabled))
}

export function usePlayerHistory(userId: string | null) {
  return useQuery({ queryKey: ['players', 'history', userId], queryFn: () => playerService.history(userId!), enabled: !!userId })
}
