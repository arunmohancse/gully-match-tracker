const ALPHABET = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no look-alikes (0/O, 1/l/I)

/** Random temporary password, easy to read out or paste into WhatsApp. */
export function generateTempPassword(length = 10): string {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('')
}

export const MIN_PASSWORD_LENGTH = 8

/** Returns an error message, or null when the new password and its confirmation are acceptable. */
export function validateNewPassword(password: string, confirm: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
  if (password !== confirm) return 'The two passwords do not match.'
  return null
}

/** True while an admin's "reset link" switch is on (it expires after 24 hours). */
export function isResetOpen(until: string | null | undefined): boolean {
  return !!until && new Date(until).getTime() > Date.now()
}
