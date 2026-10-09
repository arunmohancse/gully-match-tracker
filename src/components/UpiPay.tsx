import QRCode from 'qrcode'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { usePaymentSettings } from '@/hooks/useCommunity'
import { buildUpiUri } from '@/utils/upi'

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
  if (!src) return <p className="text-sm text-slate-500">Preparing QR code...</p>
  return <img src={src} alt="UPI QR code with the amount filled in" width={240} height={240} className="rounded-md border border-slate-200" />
}

/**
 * Pay with UPI for one amount: a button that opens the player's UPI app (on a phone) and a QR code to scan
 * (from another device or a screenshot). The amount and payee come filled in; the payer can still change them.
 * Renders nothing until an admin has set the community's UPI id.
 */
export function UpiPay({ communityId, amount, note }: { communityId: string; amount: number; note: string }) {
  const { data } = usePaymentSettings(communityId)
  const [showQr, setShowQr] = useState(false)
  if (!data?.upiId || !(amount > 0)) return null

  const uri = buildUpiUri({ upiId: data.upiId, payeeName: data.payeeName, amount, note })
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm">
          <a href={uri}>Pay with UPI app</a>
        </Button>
        <Button size="sm" variant="outline" aria-expanded={showQr} onClick={() => setShowQr(!showQr)}>
          {showQr ? 'Hide QR code' : 'Show QR code'}
        </Button>
      </div>
      {showQr && <QrPicture uri={uri} />}
      <p className="text-xs text-slate-500">Opens your UPI app with the amount filled in. Check the amount before you confirm.</p>
    </div>
  )
}
