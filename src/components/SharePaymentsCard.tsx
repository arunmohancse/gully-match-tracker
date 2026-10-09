import { Check, ClipboardCopy, QrCode, Share2 } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { usePaymentSettings } from '@/hooks/useCommunity'
import { useFinancials } from '@/hooks/usePayments'
import { useAdminRegistrations } from '@/hooks/useRegistrations'
import { toFriendlyMessage } from '@/lib/errors'
import type { Match } from '@/types/domain'
import { hasPayments, isShared } from '@/utils/cost'
import { formatINR } from '@/utils/money'
import { amountPerPlayer, buildPaymentRequest, buildPendingList, pendingPlayers } from '@/utils/paymentShare'
import { buildUpiUri, paymentInstructionsText } from '@/utils/upi'
import { makeUpiQrImage, shareOrDownloadImage } from '@/utils/upiImage'
import { buildWhatsAppShareUrl } from '@/utils/whatsapp'

interface QrShare {
  upiId: string
  payeeName: string
  amount: number
  title: string
}

function ShareBlock({ title, hint, message, qr }: { title: string; hint: string; message: string | null; qr?: QrShare | null }) {
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState<string | null>(null)
  const [qrBusy, setQrBusy] = useState(false)
  const [qrNote, setQrNote] = useState<string | null>(null)

  async function copy() {
    if (!message) return
    setCopyError(null)
    try {
      await navigator.clipboard.writeText(message)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyError('Could not copy automatically. Select the text and copy it manually.')
    }
  }

  async function shareQr() {
    if (!qr || qrBusy) return
    setQrBusy(true)
    setQrNote(null)
    try {
      const uri = buildUpiUri({ upiId: qr.upiId, payeeName: qr.payeeName, amount: qr.amount, note: qr.title })
      const blob = await makeUpiQrImage({ uri, title: qr.title, amountText: `${formatINR(qr.amount)} per player`, payee: qr.payeeName, upiId: qr.upiId })
      const result = await shareOrDownloadImage(blob, 'upi-payment-qr.png', `${qr.title}: pay ${formatINR(qr.amount)} by UPI`)
      if (result === 'downloaded') setQrNote('QR image downloaded. Attach it in your WhatsApp group.')
    } catch {
      setQrNote('Could not create the QR image. Please try again.')
    } finally {
      setQrBusy(false)
    }
  }

  return (
    <div className="space-y-2 rounded-md border border-slate-200 p-3">
      <div>
        <h3 className="font-medium">{title}</h3>
        <p className="text-sm text-slate-600">{hint}</p>
      </div>
      {message && (
        <>
          <details>
            <summary className="cursor-pointer text-sm text-slate-600">Preview message</summary>
            <pre className="mt-2 max-h-56 overflow-auto whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm">{message}</pre>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button asChild>
              <a href={buildWhatsAppShareUrl(message)} target="_blank" rel="noopener noreferrer">
                <Share2 className="size-4" aria-hidden /> Share on WhatsApp
              </a>
            </Button>
            <Button variant="outline" onClick={copy}>
              {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
              {copied ? 'Copied' : 'Copy'}
            </Button>
            {qr && (
              <Button variant="outline" onClick={shareQr} loading={qrBusy}>
                <QrCode className="size-4" aria-hidden /> {qrBusy ? 'Preparing...' : 'Share UPI QR image'}
              </Button>
            )}
          </div>
          {qrNote && (
            <p role="status" className="text-sm text-slate-600">
              {qrNote}
            </p>
          )}
          {copyError && (
            <p role="alert" className="text-sm text-red-600">
              {copyError}
            </p>
          )}
        </>
      )}
    </div>
  )
}

/**
 * Admin: two separate WhatsApp group posts.
 *  1. Right after the match: your share and where to pay (no names).
 *  2. A day or so later: the players who have not paid yet.
 * With a UPI id set, each can also share a QR image with the amount filled in (drawn in the browser, never stored).
 */
export function SharePaymentsCard({ match }: { match: Match }) {
  const { data: financials, isLoading: finLoading } = useFinancials([match.id], hasPayments(match))
  const { data: regs, error: regsError, isLoading: regsLoading } = useAdminRegistrations(match.id)
  const { data: settings } = usePaymentSettings(match.community_id)

  if (!hasPayments(match)) return null
  if (finLoading || regsLoading) return <Card className="text-slate-500">Loading payment sharing...</Card>
  if (regsError) {
    return (
      <Card role="alert" className="text-red-600">
        {toFriendlyMessage(regsError)}
      </Card>
    )
  }

  const instructions = settings ? paymentInstructionsText(settings) : ''
  const f = financials?.[0]
  const amount = amountPerPlayer(match, f)
  const request = amount !== null && f ? buildPaymentRequest(match, amount, f.main_count, instructions) : null
  const pending = pendingPlayers(match, regs ?? [])
  const pendingMessage = pending.length ? buildPendingList(match, pending, instructions) : null

  const qrBase = settings?.upiId ? { upiId: settings.upiId, payeeName: settings.payeeName, title: match.title } : null
  const requestQr = qrBase && amount !== null ? { ...qrBase, amount } : null
  const sameAmount = pending.length > 0 && pending.every((p) => p.amount === pending[0].amount)
  const pendingQr = qrBase && sameAmount ? { ...qrBase, amount: pending[0].amount } : null

  return (
    <Card className="space-y-3">
      <h2 className="font-semibold">Share payment details on WhatsApp</h2>
      {!instructions.trim() && (
        <p role="status" className="rounded-md bg-amber-50 p-2 text-sm text-amber-900">
          Payment settings are not set, so the messages will not say where to pay. Add your UPI id under Payment settings above.
        </p>
      )}
      <ShareBlock
        title="1. Payment request"
        hint={
          request
            ? 'Right after the match: the amount each player pays and where to pay. No names.'
            : isShared(match)
              ? 'Calculate the shares above first, so there is an amount to share.'
              : 'No amount to share.'
        }
        message={request}
        qr={requestQr}
      />
      <ShareBlock
        title={`2. Pending payments${pending.length ? ` (${pending.length})` : ''}`}
        hint={
          pending.length
            ? 'A day or so later: the players who have not paid yet, with a friendly reminder.'
            : amount === null
              ? 'Available once the shares are calculated.'
              : 'Nobody is pending right now.'
        }
        message={pendingMessage}
        qr={pendingQr}
      />
    </Card>
  )
}
