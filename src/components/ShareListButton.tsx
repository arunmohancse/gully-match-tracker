import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { useAdminRegistrations } from '@/hooks/useRegistrations'
import { matchShareUrl } from '@/lib/config'
import { toFriendlyMessage } from '@/lib/errors'
import type { Match } from '@/types/domain'
import { buildPlayerListMessage } from '@/utils/playerList'
import { buildWhatsAppShareUrl } from '@/utils/whatsapp'

/** Admin: send the current main list and waiting list to a WhatsApp group (you pick the group in WhatsApp). */
export function ShareListButton({ match }: { match: Match }) {
  const { data: regs, isLoading, error } = useAdminRegistrations(match.id)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  if (isLoading) return <p className="text-sm text-slate-500">Loading player list...</p>
  if (error || !regs) {
    return (
      <p role="alert" className="text-sm text-red-600">
        {toFriendlyMessage(error)}
      </p>
    )
  }

  const message = buildPlayerListMessage(match, regs, matchShareUrl(match.id))

  async function copy() {
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Could not copy automatically. Select the text above and copy it manually.')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Button asChild>
          <a href={buildWhatsAppShareUrl(message)} target="_blank" rel="noopener noreferrer" aria-label="Share player list on WhatsApp">
            <Share2 className="size-4" aria-hidden /> WhatsApp
          </a>
        </Button>
        <LinkButton onClick={copy}>{copied ? 'List copied' : 'Copy list'}</LinkButton>
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">Preview the list</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm" aria-label="Player list message">
          {message}
        </pre>
      </details>
      {copyError && (
        <p role="alert" className="text-sm text-red-600">
          {copyError}
        </p>
      )}
    </div>
  )
}
