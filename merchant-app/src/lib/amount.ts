/** Demo collection ceiling. Mirrors the limit the payment simulator enforces. */
export const MAX_COLLECT_RUPEES = 100000

export interface AmountParse {
  valid: boolean
  /** Rupees rounded to paise. Only meaningful when `valid`. */
  rupees: number
  /** Reason the input is unusable, ready to show to the merchant. */
  error: string
}

/**
 * Validates a typed rupee amount before any request is made.
 *
 * Rejects blanks, letters, negatives, more than two decimals and anything over
 * the demo ceiling, so no absurd input reaches the API or the solver.
 */
export function parseAmountRupees(raw: string): AmountParse {
  const trimmed = raw.trim().replace(/,/g, '')
  if (!trimmed) return { valid: false, rupees: 0, error: '' }
  if (!/^\d*(\.\d{0,2})?$/.test(trimmed)) {
    return { valid: false, rupees: 0, error: 'Enter digits only, with at most two decimal places.' }
  }
  const value = Number(trimmed)
  if (!Number.isFinite(value)) return { valid: false, rupees: 0, error: 'Enter a valid amount.' }
  if (value <= 0) return { valid: false, rupees: 0, error: 'Enter an amount above ₹0.' }
  if (value < 1) return { valid: false, rupees: 0, error: 'The smallest payment is ₹1.' }
  if (value > MAX_COLLECT_RUPEES) {
    return { valid: false, rupees: 0, error: `The most you can collect in one payment is ₹${MAX_COLLECT_RUPEES.toLocaleString('en-IN')}.` }
  }
  return { valid: true, rupees: Math.round(value * 100) / 100, error: '' }
}
