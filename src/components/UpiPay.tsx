import { Check, ClipboardCopy, Download } from 'lucide-react'
import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePaymentSettings } from '@/hooks/useCommunity'
import { formatINR } from '@/utils/money'
import { copyText } from '@/utils/clipboard'
import { buildUpiUri } from '@/utils/upi'
import { downloadImage, makeUpiQrImage } from '@/utils/upiImage'

/** The QR picture for a UPI link, drawn in the browser. */
function QrPicture({ uri }: { uri: string }) {
  const [src, setSrc] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    QRCode.toDataURL(uri, { width: 240, margin: 1, errorCorrectionLevel: 'M' })
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null))
    return () => {
      cancelled = true
    }
  }, [uri])
  if (!src) return <p className="text-sm text-subtle">Preparing QR code...</p>
  return <img src={src} alt="UPI QR code with the amount filled in" width={240} height={240} className="rounded-md border border-line" />
}

/**
 * Pay with UPI for one amount. UPI apps such as GPay refuse payment links opened from a browser, and a phone can't
 * scan its own screen, so the player saves the QR picture and scans it from the gallery in their UPI app.
 * The UPI id can also be copied for a manual payment. Renders nothing until an admin has set the community's UPI id.
 */
export function UpiPay({ communityId, amount, note }: { communityId: string; amount: number; note: string }) {
  const { data } = usePaymentSettings(communityId)
  const [showQr, setShowQr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  if (!data?.upiId || !(amount > 0)) return null
  const { upiId, payeeName } = data

  const uri = buildUpiUri({ upiId, payeeName, amount, note })

  async function saveQr() {
    if (busy) return
    setBusy(true)
    setMessage(null)
    try {
      const blob = await makeUpiQrImage({ uri, title: note, amountText: formatINR(amount), payee: payeeName, upiId })
      downloadImage(blob, 'upi-payment-qr.png')
      setMessage('QR saved to your downloads. Open your UPI app, choose Scan QR, then pick this image from your gallery.')
    } catch {
      setMessage('Could not create the QR image. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  async function copyId() {
    if (await copyText(upiId)) {
      setMessage(null)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } else {
      setMessage('Could not copy automatically. Touch and hold the UPI ID above to copy it.')
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button size="sm" loading={busy} onClick={saveQr}>
          <Download className="size-4" aria-hidden /> Save QR to pay
        </Button>
        <Button size="sm" variant="outline" aria-expanded={showQr} onClick={() => setShowQr(!showQr)}>
          {showQr ? 'Hide QR code' : 'Show QR code'}
        </Button>
        <Button size="sm" variant="outline" onClick={copyId}>
          {copied ? <Check className="size-4" aria-hidden /> : <ClipboardCopy className="size-4" aria-hidden />}
          {copied ? 'Copied' : 'Copy UPI ID'}
        </Button>
      </div>
      <p className="text-sm text-fg-2">
        UPI ID: <span className="select-all font-mono font-semibold break-all">{upiId}</span>
      </p>
      {showQr && <QrPicture uri={uri} />}
      {message && (
        <p role="status" className="text-sm text-fg-2">
          {message}
        </p>
      )}
      <p className="text-xs text-subtle">
        On your phone: save the QR (it goes to your downloads or gallery), open GPay, PhonePe or Paytm, tap Scan QR and pick the saved image. Check the amount before you confirm.
      </p>
    </div>
  )
}
