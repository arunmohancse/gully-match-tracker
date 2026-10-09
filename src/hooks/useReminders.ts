import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { reminderService } from '@/services/reminderService'

export function useLastReminders(matchId: string | undefined) {
  return useQuery({ queryKey: ['reminders', matchId], queryFn: () => reminderService.lastForMatch(matchId!), enabled: !!matchId })
}

export function useLogReminder() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (registrationId: string) => reminderService.logOpened(registrationId),
    onSettled: () => qc.invalidateQueries({ queryKey: ['reminders'] }),
  })
}
