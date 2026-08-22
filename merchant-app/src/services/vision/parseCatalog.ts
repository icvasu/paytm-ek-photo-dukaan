import type { OcrLine } from './ocr.ts'

export interface ParsedItem {
  name: string
  pricePaise: number
  /** 5–95. Derived from the OCR confidence plus the signals listed in `basis`. */
  confidencePct: number
  /** Human readable list of the signals that produced the confidence. */
  basis: string[]
  category: string
  sourceLine: string
}

export interface RejectedLine {
  text: string
  reason: string
}

export interface ParseOutcome {
  items: ParsedItem[]
  rejected: RejectedLine[]
  /** Lines the OCR engine produced, before any filtering. */
  linesRead: number
}

const CURRENCY = /(?:₹|Rs\.?|RS\.?|INR|rs\.?)/
const MONEY = new RegExp(
  `(${CURRENCY.source})?\\s*(\\d[\\dOolIiSsBb.,]{0,7})\\s*(?:\\/-|\\/=|-\\/)?\\s*(${CURRENCY.source})?`,
  'g',
)

/** Words that are headers or totals on a rate card, never a sellable item. */
const NOT_AN_ITEM = new Set([
  'mrp', 'rate', 'rates', 'price', 'prices', 'pricelist', 'list', 'total', 'subtotal', 'gst', 'cgst', 'sgst',
  'bill', 'invoice', 'menu', 'card', 'no', 'sr', 'qty', 'amount', 'amt', 'item', 'items', 'rupees', 'only',
  'tax', 'discount', 'cash', 'change', 'thank', 'thanks', 'welcome', 'open', 'closed', 'shop', 'store',
  'contact', 'phone', 'mobile', 'address', 'date', 'time', 'gstin', 'upi', 'paytm', 'scan', 'pay',
])

const CATEGORY_RULES: { category: string; words: string[] }[] = [
  { category: 'Hot drinks', words: ['chai', 'tea', 'coffee', 'kadak', 'kapi', 'milk tea'] },
  { category: 'Drinks', words: ['thums', 'coke', 'pepsi', 'limca', 'sprite', 'fanta', 'maaza', 'frooti', 'juice', 'water', 'soda', 'cola', 'bisleri'] },
  { category: 'Snacks', words: ['samosa', 'vada', 'pakoda', 'pakora', 'kachori', 'chips', 'namkeen', 'mixture', 'bhujia', 'sandwich', 'puff'] },
  { category: 'Biscuits', words: ['biscuit', 'parle', 'goodday', 'good day', 'marie', 'oreo', 'hide', 'seek', 'cookie', 'rusk'] },
  { category: 'Breakfast', words: ['idli', 'dosa', 'poha', 'upma', 'paratha', 'puri', 'vada pav', 'bread', 'omelette'] },
  { category: 'Staples', words: ['atta', 'rice', 'chawal', 'salt', 'namak', 'sugar', 'cheeni', 'sooji', 'maida', 'besan'] },
  { category: 'Pulses', words: ['dal', 'daal', 'toor', 'moong', 'chana', 'urad', 'masoor', 'rajma'] },
  { category: 'Cooking', words: ['oil', 'tel', 'ghee', 'masala', 'haldi', 'mirch', 'jeera', 'dhania'] },
  { category: 'Dairy', words: ['milk', 'doodh', 'curd', 'dahi', 'paneer', 'butter', 'cheese', 'amul', 'lassi'] },
  { category: 'Home care', words: ['surf', 'rin', 'vim', 'harpic', 'detergent', 'phenyl', 'broom', 'wash'] },
  { category: 'Personal care', words: ['soap', 'lifebuoy', 'lux', 'shampoo', 'paste', 'colgate', 'brush', 'cream'] },
  { category: 'Instant food', words: ['maggi', 'noodle', 'yippee', 'pasta', 'soup'] },
]

const MIN_PRICE_PAISE = 100
const MAX_PRICE_PAISE = 2_000_000

/** Repairs OCR letter/digit confusions inside a token that is already mostly digits. */
function repairDigits(token: string): string {
  const cleaned = token.replace(/[Oo]/g, '0').replace(/[lIi|]/g, '1').replace(/[Ss]/g, '5').replace(/[Bb]/g, '8')
  const digitCount = (cleaned.match(/\d/g) ?? []).length
  return digitCount >= (token.match(/[\dOolIiSsBb]/g) ?? []).length ? cleaned : token
}

function toPaise(token: string): number | null {
  const repaired = repairDigits(token).replace(/,/g, '')
  // A single trailing group of 1–2 digits after a separator is paise; anything
  // else (2,000 style grouping already stripped) is rupees.
  const match = /^(\d{1,6})(?:\.(\d{1,2}))?$/.exec(repaired)
  if (!match) return null
  const rupees = Number(match[1])
  const paiseFraction = match[2] ? Number(match[2].padEnd(2, '0')) : 0
  if (!Number.isFinite(rupees)) return null
  const paise = rupees * 100 + paiseFraction
  return paise > 0 ? paise : null
}

function cleanName(value: string): string {
  return value
    .replace(/[.·•_\-–—=:|~*]{2,}/g, ' ')
    .replace(/^[\s.·•_\-–—=:|)\]}>*#/\\]+/, '')
    .replace(/[\s.·•_\-–—=:|([{<*#/\\]+$/, '')
    .replace(new RegExp(`^${CURRENCY.source}\\s*`), '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

function letterRatio(value: string): number {
  const letters = (value.match(/[A-Za-z\u0900-\u097F]/g) ?? []).length
  return value.length ? letters / value.length : 0
}

function categoryFor(name: string): string {
  const haystack = name.toLowerCase()
  for (const rule of CATEGORY_RULES) {
    if (rule.words.some((word) => haystack.includes(word))) return rule.category
  }
  return 'General'
}

function isJunkName(name: string): boolean {
  const letters = (name.match(/[A-Za-z\u0900-\u097F]/g) ?? []).length
  if (letters < 3) return true
  if (name.length > 48) return true
  // Phone numbers, GSTINs and dates are common on a rate card header.
  if (/\d{6,}/.test(name.replace(/\s/g, ''))) return true
  if (/\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/.test(name)) return true
  // Reference codes such as a GSTIN fragment or a bank ref: a long run mixing
  // letters and digits. Real pack sizes ("750ml", "1kg") stay under six chars.
  if (/[A-Za-z0-9]{6,}/.test(name) && /\b(?=[A-Za-z0-9]{6,}\b)(?=[A-Za-z0-9]*\d)(?=[A-Za-z0-9]*[A-Za-z])[A-Za-z0-9]+\b/.test(name)) return true
  const words = name.toLowerCase().split(/[^a-z\u0900-\u097F]+/).filter(Boolean)
  if (!words.length) return true
  if (words.every((word) => NOT_AN_ITEM.has(word))) return true
  // Rate cards put the label first, so a leading header word means this row is
  // a heading or a total rather than a sellable item.
  if (NOT_AN_ITEM.has(words[0])) return true
  if (words.length > 7) return true
  return false
}

interface MoneyHit {
  paise: number
  start: number
  end: number
  hasCurrencyMark: boolean
}

function findMoney(text: string): MoneyHit[] {
  const hits: MoneyHit[] = []
  MONEY.lastIndex = 0
  let match = MONEY.exec(text)
  while (match) {
    const [whole, prefix, token, suffix] = match
    const paise = toPaise(token ?? '')
    if (paise !== null) {
      hits.push({
        paise,
        start: match.index,
        end: match.index + whole.length,
        hasCurrencyMark: Boolean(prefix || suffix),
      })
    }
    if (MONEY.lastIndex === match.index) MONEY.lastIndex += 1
    match = MONEY.exec(text)
  }
  return hits
}

/**
 * Caps a string before it reaches the screen. OCR on a dense photo can return a
 * single "line" hundreds of characters long, and both the skipped-row list and
 * the reasons below are rendered as-is.
 */
function clip(value: string, limit = 60): string {
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`
}

/**
 * Turns real OCR lines into candidate catalog rows.
 *
 * Nothing here invents an item: every row must come from text the engine
 * actually read, and lines that fail a check are returned in `rejected` with the
 * reason so the merchant can see what was skipped.
 */
export function parseCatalogLines(lines: OcrLine[]): ParseOutcome {
  const items: ParsedItem[] = []
  const rejected: RejectedLine[] = []
  const seen = new Map<string, number>()
  const reject = (text: string, reason: string) => {
    rejected.push({ text: clip(text), reason })
  }

  for (const line of lines) {
    const text = line.text.replace(/\s+/g, ' ').trim()
    if (!text) continue
    if (text.length < 3) {
      reject(text, 'Too short to be a name and a price')
      continue
    }

    const money = findMoney(text)
    if (!money.length) {
      reject(text, 'No price found on this line')
      continue
    }

    // Prefer a number carrying ₹/Rs; otherwise the last number, which is where
    // a price sits on a rate card row.
    const marked = money.filter((hit) => hit.hasCurrencyMark)
    const priceHit = (marked.length ? marked : money)
      .filter((hit) => hit.paise >= MIN_PRICE_PAISE && hit.paise <= MAX_PRICE_PAISE)
      .at(-1)
    if (!priceHit) {
      reject(text, 'Number on this line is not a believable price')
      continue
    }

    const name = cleanName(`${text.slice(0, priceHit.start)} ${text.slice(priceHit.end)}`)
    if (isJunkName(name)) {
      reject(text, name ? `“${clip(name, 28)}” does not look like an item name` : 'No item name next to the price')
      continue
    }

    const ratio = letterRatio(name)
    const ocrConfidence = Math.max(0, Math.min(100, line.confidence)) / 100
    const signals: string[] = [`OCR ${Math.round(ocrConfidence * 100)}%`]
    let score = ocrConfidence

    if (priceHit.hasCurrencyMark) {
      score *= 1.1
      signals.push('₹ symbol read')
    }
    // A name that is mostly letters is much more likely to be a real product.
    score *= 0.55 + 0.45 * Math.min(1, ratio / 0.8)
    signals.push(`${Math.round(ratio * 100)}% letters in name`)

    if (priceHit.paise > 500_00) {
      score *= 0.85
      signals.push('unusually high price')
    }
    if (money.length > 2) {
      score *= 0.9
      signals.push(`${money.length} numbers on the line`)
    }

    const confidencePct = Math.max(5, Math.min(95, Math.round(score * 100)))
    const key = name.toLowerCase().replace(/[^a-z0-9]/g, '')
    const existingIndex = seen.get(key)
    const candidate: ParsedItem = {
      // A product name is short. OCR on a dense photo can merge a whole
      // paragraph into one line, and this name is written to the catalog and
      // then into share text, so cap it here rather than at every reader.
      name: clip(name, 48),
      pricePaise: priceHit.paise,
      confidencePct,
      basis: signals,
      category: categoryFor(name),
      sourceLine: clip(text, 120),
    }

    if (existingIndex === undefined) {
      seen.set(key, items.length)
      items.push(candidate)
    } else if (items[existingIndex].confidencePct < confidencePct) {
      items[existingIndex] = candidate
    } else {
      reject(text, `Duplicate of “${clip(items[existingIndex].name, 28)}”`)
    }
  }

  return { items, rejected, linesRead: lines.length }
}
