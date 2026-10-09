/** A UPI id looks like name@bank. Matches the database check (letters, digits, . _ - before the @). */
const UPI_ID = /^[A-Za-z0-9._-]{2,255}@[A-Za-z0-9]{2,64}$/

export function isValidUpiId(value: string): boolean {
  return UPI_ID.test(value.trim())
}

export interface UpiPayment {
  upiId: string
  payeeName?: string | null
  /** Rupees. Omit to let the payer type the amount. */
  amount?: number | null
  /** Short note shown in the payer's app (for example the match title). */
  note?: string | null
}

/**
 * Standard UPI payment link (also what a UPI QR code encodes): scanning it, or tapping it on a phone,
 * opens the payer's UPI app with the payee and amount filled in. The payer can still change the amount.
 */
export function buildUpiUri({ upiId, payeeName, amount, note }: UpiPayment): string {
  const enc = (s: string) => encodeURIComponent(s)
  const parts = [`pa=${upiId.trim()}`]
  if (payeeName?.trim()) parts.push(`pn=${enc(payeeName.trim())}`)
  if (amount != null && amount > 0) parts.push(`am=${amount.toFixed(2)}`)
  parts.push('cu=INR')
  if (note?.trim()) parts.push(`tn=${enc(note.trim().slice(0, 50))}`)
  return `upi://pay?${parts.join('&')}`
}

/**
 * The "how to pay" text for messages and cards: the UPI id (unless the free text already mentions it), then the free text.
 * Returns '' when nothing is configured.
 */
export function paymentInstructionsText(s: { instructions: string; upiId: string }): string {
  const text = s.instructions.trim()
  const id = s.upiId.trim()
  const idLine = id && !text.toLowerCase().includes(id.toLowerCase()) ? `UPI ID: ${id}` : ''
  return [idLine, text].filter(Boolean).join('\n')
}
