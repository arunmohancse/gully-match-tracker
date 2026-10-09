/** Normalizes user input to digits with a leading "+" (e.g. "98765 43210" -> "+919876543210"). Returns null if invalid. */
export function normalizePhone(input: string, defaultCountryCode = '91'): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  const digits = trimmed.replace(/\D/g, '')
  let full: string
  if (trimmed.startsWith('+')) full = digits
  else if (digits.startsWith('00')) full = digits.slice(2)
  else if (digits.length === 10) full = defaultCountryCode + digits
  else full = digits
  return /^[0-9]{7,15}$/.test(full) ? `+${full}` : null
}
