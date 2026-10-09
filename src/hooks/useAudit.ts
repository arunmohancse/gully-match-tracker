import { useInfiniteQuery } from '@tanstack/react-query'
import { auditService } from '@/services/auditService'
import type { AuditCategory } from '@/utils/audit'

export function useAuditLog(category: AuditCategory, matchId: string) {
  return useInfiniteQuery({
    queryKey: ['audit', category, matchId],
    queryFn: ({ pageParam }) => auditService.list({ category, matchId, before: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  })
}
