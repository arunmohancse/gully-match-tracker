import { Check, ClipboardCopy, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
    <div className="space-y-3">
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm" aria-label="Player list message">
        {message}
      </pre>
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={buildWhatsAppShareUrl(message)} target="_blank" rel="noopener noreferrer">
            <Share2 className="size-4" aria-hidden /> Share list on WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={copy}>
          {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
          {copied ? 'List copied' : 'Copy list'}
        </Button>
      </div>
      {copyError && (
        <p role="alert" className="text-sm text-red-600">
          {copyError}
        </p>
      )}
    </div>
  )
}
