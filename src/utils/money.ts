/** Parses user-typed money ("150", "1,500.50"). Returns null when empty, negative, or with more than 2 decimals. */
export function parseMoney(input: string): number | null {
  const cleaned = input.replace(/[,\s₹]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null
  return Number(cleaned)
}

export const PAYMENT_METHODS = ['UPI', 'Cash', 'Bank transfer', 'Other'] as const
export const EXPENSE_CATEGORIES = ['Turf', 'Equipment', 'Water', 'Refreshments', 'Other'] as const

/** 150 -> "₹150", 150.5 -> "₹150.50" */
export function formatINR(amount: number | string): string {
  const value = Number(amount)
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value)
}
