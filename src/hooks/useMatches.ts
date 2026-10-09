import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { matchService, type MatchScope } from '@/services/matchService'
import type { MatchInput, MatchStatus } from '@/types/domain'

export function useMatches(scope: MatchScope) {
  return useQuery({ queryKey: ['matches', 'list', scope], queryFn: () => matchService.list(scope) })
}

export function useMatch(id: string | undefined) {
  return useQuery({ queryKey: ['matches', 'detail', id], queryFn: () => matchService.get(id!), enabled: !!id })
}

export function useSaveMatch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (args: { id?: string; input: MatchInput; imageFile: File | null; previousImagePath?: string | null }) => {
      const uploaded = args.imageFile ? await matchService.uploadImage(args.imageFile) : null
      const input = uploaded ? { ...args.input, image_path: uploaded } : args.input
      let saved
      try {
        saved = args.id ? await matchService.update(args.id, input) : await matchService.create(input)
      } catch (e) {
        await matchService.deleteImage(uploaded) // don't leave the new file orphaned when the save fails
        throw e
      }
      if (uploaded && args.previousImagePath && args.previousImagePath !== uploaded) {
        await matchService.deleteImage(args.previousImagePath) // the replaced image is no longer used
      }
      return saved
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  })
}

export function useChangeMatchStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (args: { id: string; status: MatchStatus }) => matchService.setStatus(args.id, args.status),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['matches'] }),
  })
}
