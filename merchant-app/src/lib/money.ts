export function paiseToRupees(paise: number): number {
  return paise / 100
}

export function rupeesToPaise(rupees: number): number {
  return Math.round(rupees * 100)
}

export function formatINR(paise: number, opts?: { compact?: boolean }): string {
  const rupees = paise / 100
  if (opts?.compact && Math.abs(rupees) >= 100000) {
    return `₹${(rupees / 100000).toFixed(2)} L`
  }
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: rupees % 1 === 0 ? 0 : 2,
  }).format(rupees)
}

export function formatINRPlain(paise: number): string {
  const rupees = paise / 100
  return new Intl.NumberFormat('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees)
}
