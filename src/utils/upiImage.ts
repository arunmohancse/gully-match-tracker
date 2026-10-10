import QRCode from 'qrcode'

export interface UpiImageInput {
  /** The upi://pay link to encode. */
  uri: string
  title: string
  /** For example "₹150 per player". */
  amountText: string
  payee?: string | null
  upiId: string
}

/** Draws a ready-to-send picture: match title, the QR code, the amount and the UPI id. Runs in the browser; nothing is stored. */
export async function makeUpiQrImage({ uri, title, amountText, payee, upiId }: UpiImageInput): Promise<Blob> {
  const qr = document.createElement('canvas')
  await QRCode.toCanvas(qr, uri, { width: 480, margin: 1, errorCorrectionLevel: 'M' })

  const W = 600
  const H = 780
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available')

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#0f172a'
  ctx.textAlign = 'center'

  ctx.font = 'bold 30px sans-serif'
  ctx.fillText(title.length > 34 ? `${title.slice(0, 33)}…` : title, W / 2, 56)
  ctx.font = '22px sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText('Scan with any UPI app to pay', W / 2, 92)

  ctx.drawImage(qr, (W - 480) / 2, 120)

  ctx.fillStyle = '#0f172a'
  ctx.font = 'bold 44px sans-serif'
  ctx.fillText(amountText, W / 2, 680)
  ctx.font = '24px sans-serif'
  ctx.fillStyle = '#475569'
  ctx.fillText(payee?.trim() ? `${payee.trim()} · ${upiId}` : upiId, W / 2, 722)

  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not create the image'))), 'image/png'))
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled'

/** Opens the phone's share sheet with the image attached when the browser allows it; otherwise downloads the image. */
export async function shareOrDownloadImage(blob: Blob, fileName: string, text?: string): Promise<ShareResult> {
  const file = new File([blob], fileName, { type: blob.type })
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(text ? { files: [file], text } : { files: [file] })
      return 'shared'
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled'
      // Any other failure: fall back to a download below.
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
