import type { OcrLine } from './ocr.js'
import type { RejectedLine } from './parseCatalog.js'

/**
 * Reads a supplier bill out of real OCR lines.
 *
 * A rate card only has to yield a name and a price. A supplier bill has to yield
 * a name, a quantity AND a unit cost, which is a harder problem with a much
 * better error check: the row usually prints `qty × rate = amount`, so the
 * arithmetic can be verified instead of trusted. A row whose numbers multiply
 * out correctly is strong evidence; a row that does not is reported as such.
 *
 * That check also solves the pack-size problem for free. "Thums Up 750 ml 24
 * 36.00 864.00" contains four numbers, and 750 is part of the product name. By
 * locating the triple that multiplies out first and only then taking the name
 * from the text to its left, the pack size stays in the name where it belongs.
 */

export interface ParsedInvoiceLine {
  itemName: string
  quantity: number
  unitCostPaise: number
  /** The line amount as printed, when the row had one. */
  lineTotalPaise: number | null
  /** True when quantity × unit cost matched the printed amount. */
  arithmeticVerified: boolean
  /** 5–95, from OCR confidence and the signals in `basis`. */
  confidencePct: number
  basis: string[]
  sourceLine: string
}

export interface InvoiceParseOutcome {
  supplierName: string | null
  supplierPhone: string | null
  lines: ParsedInvoiceLine[]
  rejected: RejectedLine[]
  linesRead: number
  /** A "Total" printed on the bill, when one was read. */
  readTotalPaise: number | null
  /** Sum of the rows this parser accepted. */
  computedTotalPaise: number
}

const CURRENCY = /(?:₹|Rs\.?|RS\.?|INR|rs\.?)/

/** Column headers and footer rows: never a stocked item. */
const NOT_AN_ITEM = new Set([
  'total', 'subtotal', 'grand', 'net', 'payable', 'balance', 'due', 'amount', 'amt', 'qty', 'quantity',
  'rate', 'price', 'mrp', 'hsn', 'sac', 'gst', 'cgst', 'sgst', 'igst', 'tax', 'taxable', 'cess',
  'invoice', 'bill', 'challan', 'receipt', 'date', 'no', 'sr', 'sl', 'particulars', 'description',
  'item', 'items', 'goods', 'discount', 'round', 'rounding', 'signature', 'authorised', 'thank',
  'thanks', 'terms', 'conditions', 'gstin', 'pan', 'phone', 'mobile', 'address', 'state', 'code',
  'vehicle', 'transport', 'eway', 'place', 'supply', 'reverse', 'charge', 'declaration', 'rupees',
  'only', 'page', 'delivery', 'order', 'ref', 'cash', 'credit', 'paid', 'outstanding',
])

/** Words that mark a business name on an Indian distributor bill. */
const SUPPLIER_HINTS = [
  'traders', 'trading', 'distributor', 'distributors', 'agency', 'agencies', 'enterprise',
  'enterprises', 'suppliers', 'supplier', 'stores', 'store', 'sons', 'brothers', 'bros',
  'company', 'co', 'pvt', 'ltd', 'llp', 'corporation', 'marketing', 'sales', 'depot',
  'wholesale', 'wholesalers', 'foods', 'beverages', 'products', 'industries',
]

const MIN_UNIT_COST_PAISE = 50
const MAX_UNIT_COST_PAISE = 2_000_000
const MAX_QUANTITY = 999

interface NumberHit {
  /** Face value: rupees for money, a plain count for a quantity. */
  value: number
  /** Value read as paise. Only meaningful when the token is money. */
  paise: number
  start: number
  end: number
  hasCurrencyMark: boolean
  hasDecimals: boolean
}

/** Repairs OCR letter/digit confusions inside a token that is already mostly digits. */
function repairDigits(token: string): string {
  const cleaned = token.replace(/[Oo]/g, '0').replace(/[lIi|]/g, '1').replace(/[Ss]/g, '5').replace(/[Bb]/g, '8')
  const digitCount = (cleaned.match(/\d/g) ?? []).length
  return digitCount >= (token.match(/[\dOolIiSsBb]/g) ?? []).length ? cleaned : token
}

function findNumbers(text: string): NumberHit[] {
  const pattern = new RegExp(`(${CURRENCY.source})?\\s*(\\d[\\dOolIiSsBb.,]{0,9})\\s*(${CURRENCY.source})?`, 'g')
  const hits: NumberHit[] = []
  let match = pattern.exec(text)
  while (match) {
    const [whole, prefix, rawToken, suffix] = match
    const token = repairDigits(rawToken ?? '').replace(/,/g, '')
    const shape = /^(\d{1,7})(?:\.(\d{1,2}))?$/.exec(token)
    if (shape) {
      const rupees = Number(shape[1])
      const fraction = shape[2] ? Number(shape[2].padEnd(2, '0')) : 0
      if (Number.isFinite(rupees)) {
        // Offsets are measured against `whole`, which may lead with whitespace.
        const leading = whole.length - whole.trimStart().length
        hits.push({
          value: rupees + fraction / 100,
          paise: rupees * 100 + fraction,
          start: match.index + leading,
          end: match.index + whole.trimEnd().length,
          hasCurrencyMark: Boolean(prefix || suffix),
          hasDecimals: Boolean(shape[2]),
        })
      }
    }
    if (pattern.lastIndex === match.index) pattern.lastIndex += 1
    match = pattern.exec(text)
  }
  return hits
}

function cleanName(value: string): string {
  return value
    .replace(/[.·•_=~*]{2,}/g, ' ')
    .replace(/^[\s.·•_=:|)\]}>*#/\\-]+/, '')
    .replace(/[\s.·•_=:|([{<*#/\\-]+$/, '')
    // Only a standalone currency token. Without the leading boundary this eats
    // the "rs" out of "Traders" and renames the supplier.
    .replace(new RegExp(`(?:^|\\s)${CURRENCY.source}\\s*$`), '')
    .replace(/\b(?:x|X|×|@|nos?|pcs?|pkt|pkts|units?|box|boxes|crate|crates|case|cases|ctn)\b\s*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function words(value: string): string[] {
  return value.toLowerCase().split(/[^a-z\u0900-\u097F]+/).filter(Boolean)
}

function isJunkName(name: string): boolean {
  const letters = (name.match(/[A-Za-z\u0900-\u097F]/g) ?? []).length
  if (letters < 3) return true
  if (name.length > 60) return true
  // A long digit run is a GSTIN, an invoice number or a phone, not a product.
  if (/\d{6,}/.test(name.replace(/\s/g, ''))) return true
  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(name)) return true
  const parts = words(name)
  if (!parts.length) return true
  if (parts.every((word) => NOT_AN_ITEM.has(word))) return true
  if (NOT_AN_ITEM.has(parts[0])) return true
  if (parts.length > 8) return true
  return false
}

function plausibleQuantity(hit: NumberHit): boolean {
  return !hit.hasDecimals && Number.isInteger(hit.value) && hit.value >= 1 && hit.value <= MAX_QUANTITY
}

/** Units that make a number a pack size ("750 ml"), never an order quantity. */
const PACK_UNIT = /^\s*(?:ml|l|ltr|lt|litre|liter|g|gm|gms|gram|grams|kg|kgs|mg|cl|oz|inch|cm|mm|w|watt)\b/i

/**
 * True when the number is immediately followed by a measurement unit, so it
 * belongs to the product name. "Limca 750 ml 32.00" must not order 750 Limcas.
 */
function isPackSize(text: string, hit: NumberHit): boolean {
  return PACK_UNIT.test(text.slice(hit.end))
}

function plausibleUnitCost(hit: NumberHit): boolean {
  return hit.paise >= MIN_UNIT_COST_PAISE && hit.paise <= MAX_UNIT_COST_PAISE
}

/**
 * Rightmost `qty × rate = amount` triple on the line.
 *
 * Rightmost because bill columns run name → qty → rate → amount, so any number
 * inside the product name sits to the left of the real figures.
 */
function findVerifiedTriple(text: string, hits: NumberHit[]) {
  for (let index = hits.length - 3; index >= 0; index -= 1) {
    const [qty, rate, amount] = [hits[index], hits[index + 1], hits[index + 2]]
    if (!plausibleQuantity(qty) || !plausibleUnitCost(rate)) continue
    if (isPackSize(text, qty)) continue
    const expected = qty.value * rate.paise
    // Bills round the extended amount to the rupee often enough that an exact
    // match is too strict; half a percent still rules out a coincidence.
    const tolerance = Math.max(100, expected * 0.005)
    if (Math.abs(expected - amount.paise) <= tolerance) {
      return { qty, rate, amount }
    }
  }
  return null
}

/** Explicit `24 x 36.00` / `24 @ 36` notation, which states the quantity outright. */
function findExplicitPair(text: string, hits: NumberHit[]) {
  const pattern = /(\d{1,3})\s*(?:x|X|×|@)\s*(?:₹|Rs\.?|INR)?\s*(\d[\d.,]*)/g
  for (let match = pattern.exec(text); match; match = pattern.exec(text)) {
    const from = match.index
    const to = match.index + match[0].length
    const qty = hits.find((hit) => hit.start === from)
    const rate = hits.find((hit) => hit !== qty && hit.start >= from && hit.end <= to)
    if (qty && rate && plausibleQuantity(qty) && plausibleUnitCost(rate)) return { qty, rate }
  }
  return null
}

function clip(value: string, limit = 60): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}

function readPhone(text: string): string | null {
  const compact = text.replace(/[\s-()]/g, '')
  const match = /(?:\+?91)?([6-9]\d{9})(?!\d)/.exec(compact)
  return match ? match[1] : null
}

function looksLikeSupplierName(text: string): boolean {
  const parts = words(text)
  if (!parts.length || parts.length > 8) return false
  return parts.some((word) => SUPPLIER_HINTS.includes(word))
}

/**
 * Turns real OCR lines into supplier bill rows.
 *
 * Nothing is invented. A row that does not yield a quantity and a unit cost is
 * returned in `rejected` with the reason, because a supplier bill with a guessed
 * quantity would put a wrong number into the stock ledger and the reorder total.
 */
export function parseInvoiceLines(ocrLines: OcrLine[]): InvoiceParseOutcome {
  const lines: ParsedInvoiceLine[] = []
  const rejected: RejectedLine[] = []
  const headerCandidates: string[] = []
  let supplierPhone: string | null = null
  let readTotalPaise: number | null = null

  const reject = (text: string, reason: string) => rejected.push({ text: clip(text), reason })

  for (const ocrLine of ocrLines) {
    const text = ocrLine.text.replace(/\s+/g, ' ').trim()
    if (!text) continue

    if (!supplierPhone) supplierPhone = readPhone(text)

    const hits = findNumbers(text)
    const parts = words(text)

    // A printed total is useful as a cross-check even though it is not an item.
    if (parts.length && /^(?:grand\s*)?(?:total|net|payable)$/.test(parts.slice(0, 2).join(' ')) && hits.length) {
      readTotalPaise = hits.at(-1)!.paise
      reject(text, 'Bill total, not an item')
      continue
    }

    if (!hits.length) {
      // No numbers at all: a header, an address or the supplier's own name.
      if (parts.length && !parts.every((word) => NOT_AN_ITEM.has(word))) headerCandidates.push(text)
      reject(text, 'No quantity or cost on this line')
      continue
    }

    if (text.length < 4) {
      reject(text, 'Too short to be a bill row')
      continue
    }

    const triple = findVerifiedTriple(text, hits)
    const pair = triple ? null : findExplicitPair(text, hits)

    let quantity: number
    let unitCostPaise: number
    let lineTotalPaise: number | null = null
    let arithmeticVerified = false
    let nameEnd: number
    const signals: string[] = []

    if (triple) {
      quantity = triple.qty.value
      unitCostPaise = triple.rate.paise
      lineTotalPaise = triple.amount.paise
      arithmeticVerified = true
      nameEnd = triple.qty.start
      signals.push(`${quantity} × ₹${(unitCostPaise / 100).toFixed(2)} = ₹${(lineTotalPaise / 100).toFixed(2)} checks out`)
    } else if (pair) {
      quantity = pair.qty.value
      unitCostPaise = pair.rate.paise
      nameEnd = pair.qty.start
      signals.push('quantity written as “qty × rate”')
    } else {
      // Fall back to the last two numbers as quantity and unit cost, which is
      // the common two-column bill. Anything less is not enough to record.
      const tail = hits.slice(-2)
      if (tail.length === 2 && plausibleQuantity(tail[0]) && plausibleUnitCost(tail[1])
        && !tail[0].hasCurrencyMark && !isPackSize(text, tail[0])) {
        quantity = tail[0].value
        unitCostPaise = tail[1].paise
        nameEnd = tail[0].start
        signals.push('read as quantity then unit cost')
      } else {
        reject(text, hits.length === 1
          ? 'Only one number on this line, so the quantity is unknown'
          : 'Could not tell which number was the quantity')
        continue
      }
    }

    const itemName = cleanName(text.slice(0, nameEnd))
    if (isJunkName(itemName)) {
      if (looksLikeSupplierName(text)) headerCandidates.push(text)
      reject(text, itemName ? `“${clip(itemName, 28)}” does not look like an item name` : 'No item name before the quantity')
      continue
    }

    const ocrConfidence = Math.max(0, Math.min(100, ocrLine.confidence)) / 100
    let score = ocrConfidence
    signals.unshift(`OCR ${Math.round(ocrConfidence * 100)}%`)
    if (arithmeticVerified) {
      // The strongest signal available: three independently read numbers agree.
      score = Math.min(1, score * 1.35)
    } else {
      score *= 0.75
      signals.push('no printed amount to check against')
    }

    lines.push({
      itemName: clip(itemName, 48),
      quantity,
      unitCostPaise,
      lineTotalPaise,
      arithmeticVerified,
      confidencePct: Math.max(5, Math.min(95, Math.round(score * 100))),
      basis: signals,
      sourceLine: clip(text, 120),
    })
  }

  // The supplier's own name is normally the largest text at the top. Among the
  // lines that carried no item, prefer one that reads like a business name.
  const named = headerCandidates.find(looksLikeSupplierName)
  const supplierName = named
    ? clip(cleanName(named), 60)
    : headerCandidates.length
      ? clip(cleanName(headerCandidates[0]), 60)
      : null

  return {
    supplierName: supplierName || null,
    supplierPhone,
    lines,
    rejected,
    linesRead: ocrLines.length,
    readTotalPaise,
    computedTotalPaise: lines.reduce((sum, line) => sum + line.quantity * line.unitCostPaise, 0),
  }
}
