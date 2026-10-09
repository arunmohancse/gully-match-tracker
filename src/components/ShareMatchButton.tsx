import { Check, ClipboardCopy, Link2, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
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
      <div className="flex flex-wrap gap-2">
        <Button asChild>
          <a href={buildWhatsAppShareUrl(announcement)} target="_blank" rel="noopener noreferrer">
            <Share2 className="size-4" aria-hidden /> Share on WhatsApp
          </a>
        </Button>
        <Button variant="outline" onClick={() => copy('text', announcement)}>
          {copied === 'text' ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
          {copied === 'text' ? 'Announcement copied' : 'Copy announcement'}
        </Button>
        <Button variant="outline" onClick={() => copy('link', url)}>
          {copied === 'link' ? <Check className="size-4" aria-hidden /> : <Link2 className="size-4" aria-hidden />}
          {copied === 'link' ? 'Link copied' : 'Copy link'}
        </Button>
      </div>
      {error && (
        <p role="alert" className="break-all text-sm text-red-600">
          {error}
        </p>
      )}
    </div>
  )
}
