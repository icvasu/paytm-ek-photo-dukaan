/**
 * UPI intent URIs (NPCI "UPI Linking Specification", the `upi://pay` deep link).
 *
 * This is the one part of the payment path that is genuinely real: the string
 * built here is the same string a Paytm QR encodes, so scanning it opens Paytm
 * (or any UPI app) on the payee and amount below. Nothing here settles money —
 * confirmation still comes from the bank, and this prototype never claims it.
 */

/** Payee VPA per the NPCI spec: handle@psp. */
const VPA_PATTERN = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]{0,60}[a-zA-Z0-9])?@[a-zA-Z][a-zA-Z0-9.-]{1,63}$/

/** NPCI caps the transaction note at 50 characters. */
const MAX_NOTE_LENGTH = 50
/** NPCI caps the transaction reference at 35 characters. */
const MAX_REF_LENGTH = 35
const MAX_PAYEE_NAME_LENGTH = 50

/** Per-transaction UPI ceiling for a small merchant. Above this, apps reject. */
export const MAX_UPI_AMOUNT_RUPEES = 100_000
export const MIN_UPI_AMOUNT_RUPEES = 1

/**
 * Obviously-not-real default. A demo must never point a judge's UPI app at a
 * stranger's account, and a plausible-looking invented VPA would be worse than
 * one that is visibly a placeholder. Override with VITE_MERCHANT_VPA to make
 * the QR land in a real account.
 */
export const PLACEHOLDER_VPA = 'example.merchant@upi'

function readEnvVpa(): string | undefined {
  try {
    const value = import.meta.env?.VITE_MERCHANT_VPA
    return typeof value === 'string' && value.trim() ? value.trim() : undefined
  } catch {
    return undefined
  }
}

/**
 * The VPA every QR in this app encodes. Configured, not hardcoded, so the same
 * build can point at a real merchant account without a code change.
 */
export function merchantVpa(): string {
  const configured = readEnvVpa()
  if (configured && isValidVpa(configured)) return configured
  return PLACEHOLDER_VPA
}

/** True when the QR points at the placeholder, so the UI can say so out loud. */
export function isPlaceholderVpa(vpa: string): boolean {
  return vpa === PLACEHOLDER_VPA
}

export function isValidVpa(value: string): boolean {
  return VPA_PATTERN.test(value.trim())
}

/** Rupees → the `am` parameter. UPI requires a plain decimal with 2 places. */
export function formatUpiAmount(rupees: number): string {
  return (Math.round(rupees * 100) / 100).toFixed(2)
}

/**
 * Strips what UPI apps choke on and clamps to the spec length. Percent-encoding
 * happens later; this removes characters that are invalid even when encoded.
 */
function sanitizeText(value: string, maxLength: number): string {
  return value
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength)
}

/** Transaction reference: uppercase alphanumerics only, per the spec. */
export function sanitizeTxnRef(value: string): string {
  return value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase().slice(0, MAX_REF_LENGTH)
}

/** Fresh, collision-resistant reference for one collect attempt. */
export function createTxnRef(prefix = 'EPD'): string {
  const stamp = Date.now().toString(36)
  const salt = Math.random().toString(36).slice(2, 8)
  return sanitizeTxnRef(`${prefix}${stamp}${salt}`)
}

export interface UpiIntentInput {
  /** Payee VPA. Defaults to the configured merchant VPA. */
  vpa?: string
  /** Payee name shown by the UPI app. */
  payeeName: string
  /** Omit or pass undefined for a static shop QR the customer types into. */
  amountRupees?: number
  note?: string
  txnRef?: string
}

export interface UpiIntent {
  /** The scannable / tappable `upi://pay?...` string. */
  uri: string
  vpa: string
  payeeName: string
  /** Fixed-2dp amount string, or null for a static QR. */
  amount: string | null
  note: string | null
  txnRef: string | null
  /** True when no amount is encoded, so the customer types it in their app. */
  isStatic: boolean
  usesPlaceholderVpa: boolean
}

export class UpiIntentError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'UpiIntentError'
  }
}

/**
 * Builds a standards-compliant UPI intent URI.
 *
 * Every value is validated before it is encoded, because a malformed `upi://`
 * link fails silently inside the payment app — the QR scans and then nothing
 * happens, which is the worst possible failure on stage.
 */
export function buildUpiIntent(input: UpiIntentInput): UpiIntent {
  const vpa = (input.vpa ?? merchantVpa()).trim()
  if (!isValidVpa(vpa)) {
    throw new UpiIntentError(`“${vpa}” is not a valid UPI ID. Expected a handle like name@bank.`)
  }

  const payeeName = sanitizeText(input.payeeName, MAX_PAYEE_NAME_LENGTH)
  if (!payeeName) throw new UpiIntentError('A payee name is required for a UPI intent.')

  let amount: string | null = null
  if (input.amountRupees !== undefined && input.amountRupees !== null) {
    const value = Number(input.amountRupees)
    if (!Number.isFinite(value)) {
      throw new UpiIntentError('Enter a number for the amount.')
    }
    // Sub-paise amounts cannot be represented, so reject rather than silently round.
    if (Math.abs(value * 100 - Math.round(value * 100)) > 1e-9) {
      throw new UpiIntentError('UPI amounts cannot be finer than one paisa.')
    }
    if (value < MIN_UPI_AMOUNT_RUPEES) {
      throw new UpiIntentError(`UPI needs at least ₹${MIN_UPI_AMOUNT_RUPEES}.`)
    }
    if (value > MAX_UPI_AMOUNT_RUPEES) {
      throw new UpiIntentError(`UPI apps reject a single payment above ₹${MAX_UPI_AMOUNT_RUPEES.toLocaleString('en-IN')}.`)
    }
    amount = formatUpiAmount(value)
  }

  const note = input.note ? sanitizeText(input.note, MAX_NOTE_LENGTH) : ''
  const txnRef = input.txnRef ? sanitizeTxnRef(input.txnRef) : ''

  // Order follows the NPCI examples. pa/pn/cu are always present; am/tn/tr are
  // only emitted when they carry a value, since empty params break some apps.
  const params: [string, string][] = [
    ['pa', vpa],
    ['pn', payeeName],
  ]
  if (amount) params.push(['am', amount])
  params.push(['cu', 'INR'])
  if (note) params.push(['tn', note])
  if (txnRef) params.push(['tr', txnRef])

  const query = params
    .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
    .join('&')

  return {
    uri: `upi://pay?${query}`,
    vpa,
    payeeName,
    amount,
    note: note || null,
    txnRef: txnRef || null,
    isStatic: amount === null,
    usesPlaceholderVpa: isPlaceholderVpa(vpa),
  }
}

/**
 * Inverse of `buildUpiIntent`, used by tests and by the on-screen decode panel
 * so what a judge scans can be checked against what we claim to have encoded.
 */
export function parseUpiIntent(uri: string): Record<string, string> | null {
  const match = /^upi:\/\/pay\?(.*)$/.exec(uri.trim())
  if (!match) return null
  const out: Record<string, string> = {}
  for (const pair of match[1].split('&')) {
    if (!pair) continue
    const index = pair.indexOf('=')
    if (index < 0) continue
    out[pair.slice(0, index)] = decodeURIComponent(pair.slice(index + 1))
  }
  return out
}

/** Static shop QR: no amount, so the customer enters it in their own app. */
export function shopIntent(businessName: string, vpa?: string): UpiIntent {
  return buildUpiIntent({ vpa, payeeName: businessName, note: 'Shop payment' })
}

/** Dynamic QR for a known total. */
export function collectIntent(
  businessName: string,
  amountRupees: number,
  options: { note?: string; txnRef?: string; vpa?: string } = {},
): UpiIntent {
  return buildUpiIntent({
    vpa: options.vpa,
    payeeName: businessName,
    amountRupees,
    note: options.note,
    txnRef: options.txnRef ?? createTxnRef(),
  })
}

/**
 * `upi://` only resolves where a UPI app is installed. On a desktop browser the
 * link dead-ends, so the UI shows the QR instead of a tappable button.
 */
export function supportsUpiIntentLink(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android|iphone|ipad|ipod/i.test(navigator.userAgent)
}
