import { Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { LinkButton } from '@/components/ui/link-button'
import { matchShareUrl } from '@/lib/config'
import type { Match } from '@/types/domain'
import { buildAnnouncement } from '@/utils/announcement'
import { buildWhatsAppShareUrl } from '@/utils/whatsapp'

type Copied = 'link' | 'text' | null

export function ShareMatchButton({ match }: { match: Match }) {
  const [copied, setCopied] = useState<Copied>(null)
  const [error, setError] = useState<string | null>(null)
  const url = matchShareUrl(match.id)
  const announcement = buildAnnouncement(match, url)

  async function copy(kind: Exclude<Copied, null>, text: string) {
    setError(null)
    try {
      await navigator.clipboard.writeText(text)
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      setError('Could not copy automatically. Please copy it manually: ' + url)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <Button asChild>
          <a href={buildWhatsAppShareUrl(announcement)} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
            <Share2 className="size-4" aria-hidden /> WhatsApp
          </a>
        </Button>
        <LinkButton onClick={() => copy('text', announcement)}>{copied === 'text' ? 'Announcement copied' : 'Copy announcement'}</LinkButton>
        <LinkButton onClick={() => copy('link', url)}>{copied === 'link' ? 'Link copied' : 'Copy link'}</LinkButton>
      </div>
      {error && (
        <p role="alert" className="break-all text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
