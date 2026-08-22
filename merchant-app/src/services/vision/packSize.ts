/**
 * Pack sizes as they appear on a photographed price list.
 *
 * The printed text is the source of truth for anything it actually states. A
 * lexicon entry carries its own pack size ("Surf Excel Easy Wash 500 g"), and
 * letting that name replace a card that reads "Surf Excel 1 kg" puts a fact on
 * screen the photo never showed. These helpers let the lexicon keep doing the
 * matching while the printed pack size survives to the display name.
 *
 * They also unglue a pack size OCR ran together with the word before it, so
 * "Atta5kg" can be read as the pack size it is rather than as a reference code.
 */

/** Units a kirana rate card actually prints, mapped to a comparable base. */
const UNITS: Record<string, { base: 'g' | 'ml'; factor: number }> = {
  kg: { base: 'g', factor: 1000 },
  kgs: { base: 'g', factor: 1000 },
  kilo: { base: 'g', factor: 1000 },
  g: { base: 'g', factor: 1 },
  gm: { base: 'g', factor: 1 },
  gms: { base: 'g', factor: 1 },
  gram: { base: 'g', factor: 1 },
  grams: { base: 'g', factor: 1 },
  ml: { base: 'ml', factor: 1 },
  l: { base: 'ml', factor: 1000 },
  lt: { base: 'ml', factor: 1000 },
  ltr: { base: 'ml', factor: 1000 },
  litre: { base: 'ml', factor: 1000 },
  liter: { base: 'ml', factor: 1000 },
}

/** Longest first, so "kg" wins over "g" and "ltr" over "l". */
const UNIT_ALTERNATION = Object.keys(UNITS)
  .sort((a, b) => b.length - a.length)
  .join('|')

const QUANTITY = String.raw`\d{1,4}(?:\.\d{1,2})?`

/**
 * A quantity followed by a unit that ends the token.
 *
 * The trailing `(?![A-Za-z0-9])` is what keeps this away from reference codes: a
 * GSTIN such as `29ABCDE1234G1Z5` has a `4G`, but the `G` is followed by more
 * alphanumerics, so it is not a unit and nothing here treats it as one.
 */
const PACK_SIZE = new RegExp(`(${QUANTITY})\\s*(${UNIT_ALTERNATION})(?![A-Za-z0-9])`, 'i')

const GLUED_TO_WORD = new RegExp(
  `([A-Za-z])(${QUANTITY})\\s*(${UNIT_ALTERNATION})(?![A-Za-z0-9])`,
  'gi',
)
const GLUED_TO_QUANTITY = new RegExp(`(${QUANTITY})(${UNIT_ALTERNATION})(?![A-Za-z0-9])`, 'gi')

export interface PackSize {
  /** The pack size as printed, with the quantity and unit separated. */
  text: string
  quantity: number
  unit: string
  /** Quantity converted to grams or millilitres, so sizes can be compared. */
  baseQuantity: number
  base: 'g' | 'ml'
}

/**
 * Separates a pack size OCR ran together with its neighbours: "Atta5kg" becomes
 * "Atta 5 kg" and "1L" becomes "1 L".
 *
 * Only a unit that ends its token is unglued, so this cannot open a hole for a
 * GSTIN or a bank reference — those never end in a printed unit.
 */
export function splitGluedUnits(value: string): string {
  return value
    .replace(GLUED_TO_WORD, (_match, word: string, quantity: string, unit: string) => `${word} ${quantity} ${unit}`)
    .replace(GLUED_TO_QUANTITY, (_match, quantity: string, unit: string) => `${quantity} ${unit}`)
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** The pack size a name states, or null when it states none. */
export function readPackSize(value: string): PackSize | null {
  const match = PACK_SIZE.exec(value)
  if (!match) return null
  const quantity = Number(match[1])
  if (!Number.isFinite(quantity) || quantity <= 0) return null
  const unit = match[2]
  const spec = UNITS[unit.toLowerCase()]
  if (!spec) return null
  return {
    text: `${match[1]} ${unit}`,
    quantity,
    unit,
    baseQuantity: quantity * spec.factor,
    base: spec.base,
  }
}

/**
 * Whether two names state the same physical pack size. "1 kg" and "1000 g"
 * agree; "1 kg" and "500 g" do not. A missing pack size never agrees with a
 * stated one, because silence is not a claim.
 */
export function samePackSize(left: PackSize | null, right: PackSize | null): boolean {
  if (!left || !right) return false
  return left.base === right.base && Math.abs(left.baseQuantity - right.baseQuantity) < 0.001
}

/** The name with its pack size removed, for when the photo stated none. */
export function stripPackSize(value: string): string {
  return value
    .replace(PACK_SIZE, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^[\s,\-–—]+|[\s,\-–—]+$/g, '')
    .trim()
}
