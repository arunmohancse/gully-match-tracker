import { Copy, Link2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { matchShareUrl } from '@/lib/config'
import type { Match } from '@/types/domain'
import { buildAnnouncement } from '@/utils/announcement'
import { buildWhatsAppShareUrl } from '@/utils/whatsapp'
import { copyText } from '@/utils/clipboard'

type Copied = 'link' | 'text' | null

export function ShareMatchButton({ match }: { match: Match }) {
  const [copied, setCopied] = useState<Copied>(null)
  const [error, setError] = useState<string | null>(null)
  const url = matchShareUrl(match.id)
  const announcement = buildAnnouncement(match, url)

  async function copy(kind: Exclude<Copied, null>, text: string) {
    setError(null)
    if (await copyText(text)) {
      setCopied(kind)
      setTimeout(() => setCopied(null), 2000)
    } else {
      setError('Could not copy automatically. Please copy it manually: ' + url)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Button asChild className="flex-1">
          <a href={buildWhatsAppShareUrl(announcement)} target="_blank" rel="noopener noreferrer" aria-label="Share on WhatsApp">
            <Share2 className="size-4" aria-hidden /> WhatsApp
          </a>
        </Button>
        <Button variant="outline" className="w-12 px-0" onClick={() => copy('text', announcement)} aria-label="Copy announcement" title="Copy announcement">
          <Copy className="size-4" aria-hidden />
        </Button>
        <Button variant="outline" className="w-12 px-0" onClick={() => copy('link', url)} aria-label="Copy link" title="Copy link">
          <Link2 className="size-4" aria-hidden />
        </Button>
      </div>
      <p role="status" className="min-h-5 text-sm font-semibold text-success">
        {copied === 'text' ? 'Announcement copied' : copied === 'link' ? 'Link copied' : ''}
      </p>
      {error && (
        <p role="alert" className="break-all text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  )
}
