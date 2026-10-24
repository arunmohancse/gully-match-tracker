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
import { copyText } from '@/utils/clipboard'
import { CricketLoader } from '@/components/CricketLoader'

/** Admin: send the current main list and waiting list to a WhatsApp group (you pick the group in WhatsApp). */
export function ShareListButton({ match }: { match: Match }) {
  const { data: regs, isLoading, error } = useAdminRegistrations(match.id)
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)

  if (isLoading) return <CricketLoader size="sm" label="Loading player list" />
  if (error || !regs) {
    return (
      <p role="alert" className="text-sm text-danger">
        {toFriendlyMessage(error)}
      </p>
    )
  }

  const message = buildPlayerListMessage(match, regs, matchShareUrl(match.id))

  async function copy() {
    setCopyError(null)
    if (await copyText(message)) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
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
        <summary className="cursor-pointer text-sm text-muted">Preview the list</summary>
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-surface-2 p-3 text-sm" aria-label="Player list message">
          {message}
        </pre>
      </details>
      {copyError && (
        <p role="alert" className="text-sm text-danger">
          {copyError}
        </p>
      )}
    </div>
  )
}
