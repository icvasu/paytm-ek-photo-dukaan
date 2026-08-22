import { describe, expect, it } from 'vitest'
import { parseCatalogLines } from './parseCatalog.js'
import { resolveItems, type ResolvedItem } from './resolveItems.js'

/** Puts one printed line through the shipped path: parse, then resolve. */
function readLine(text: string, confidence = 90): ResolvedItem {
  const parse = parseCatalogLines([{ text, confidence }])
  expect(parse.items, `“${text}” produced no priced row`).toHaveLength(1)
  return resolveItems(parse.items)[0]
}

describe('the printed pack size survives the lexicon', () => {
  /*
   * The three rows below are the ones the shipped rate-card photo actually
   * produced before this was fixed. Each one had the right price and a pack size
   * the card never printed, which is the most expensive kind of wrong: a judge
   * holding the card sees "1 kg" become "500 g" and concludes the app invents
   * product details.
   */
  it('keeps “Surf Excel 1 kg” instead of the lexicon’s 500 g', () => {
    const item = readLine('Surf Excel 1 kg 120')
    expect(item.name).toBe('Surf Excel 1 kg')
    expect(item.pricePaise).toBe(12000)
    // Still matched, so stock and restock can recognise the row.
    expect(item.matched).toBe(true)
    expect(item.suggestedId).toBe('surf-excel')
    expect(item.evidence.printedPackSize).toBe('1 kg')
    expect(item.evidence.lexiconPackSize).toBe('500 g')
    expect(item.evidence.nameKeptAsPrinted).toBe(true)
    expect(item.evidence.nameNote).toContain('1 kg')
  })

  it('keeps “Parle-G Biscuit” rather than adding a 250 g the card never printed', () => {
    const item = readLine('Parle-G Biscuit 10')
    expect(item.name).toBe('Parle-G Biscuit')
    expect(item.name).not.toMatch(/\d/)
    expect(item.pricePaise).toBe(1000)
    expect(item.matched).toBe(true)
    expect(item.suggestedId).toBe('parle-g')
    expect(item.evidence.printedPackSize).toBeNull()
    expect(item.evidence.lexiconPackSize).toBe('250 g')
    expect(item.evidence.nameKeptAsPrinted).toBe(true)
  })

  it('keeps “Britannia Bread” rather than replacing it with “Bread 400 g”', () => {
    const item = readLine('Britannia Bread 45')
    expect(item.name).toBe('Britannia Bread')
    expect(item.name).not.toMatch(/\d/)
    expect(item.pricePaise).toBe(4500)
    expect(item.matched).toBe(true)
    expect(item.suggestedId).toBe('bread')
  })

  it('never shows a pack size for a row whose line printed none', () => {
    for (const line of ['Parle-G Biscuit 10', 'Britannia Bread 45', 'Maggi Noodles 14']) {
      const item = readLine(line)
      expect(item.evidence.printedPackSize, line).toBeNull()
      expect(item.name, line).not.toMatch(/\d/)
    }
  })

  it('lets the lexicon re-spell the words the card printed', () => {
    const item = readLine('Aashinvaad Atta5kg 295', 82)
    expect(item.name).toBe('Aashirvaad Atta 5 kg')
    expect(item.evidence.nameKeptAsPrinted).toBe(false)
    // The pack size survived the rename because both sides state the same one.
    expect(item.evidence.printedPackSize).toBe('5 kg')
  })

  it('does not let the lexicon add a word the card never printed', () => {
    // "Fortune Sunflower Oil 1 L" is the lexicon entry; the card said "Fortune
    // Oil 1L". The pack size agrees, but "Sunflower" is our word, not the card's.
    const item = readLine('Fortune Oil 1L 140')
    expect(item.name).toBe('Fortune Oil 1 L')
    expect(item.matched).toBe(true)
    expect(item.suggestedId).toBe('fortune-oil')
    expect(item.evidence.nameKeptAsPrinted).toBe(true)
  })

  it('does not call “1000 g” a contradiction of the lexicon’s 1 kg', () => {
    const sameSize = readLine('Tata Salt 1000 g 28')
    expect(sameSize.name).toBe('Tata Salt 1000 g')
    // The same pack written differently is not reported as a disagreement.
    expect(sameSize.evidence.nameNote).not.toContain('kept the printed')
    // A genuinely different pack is.
    const smaller = readLine('Tata Salt 500 g 18')
    expect(smaller.name).toBe('Tata Salt 500 g')
    expect(smaller.evidence.nameNote).toContain('kept the printed “500 g”')
    expect(smaller.evidence.nameNote).toContain('1 kg')
  })

  it('keeps a printed brand the lexicon entry does not carry', () => {
    const item = readLine('Red Label Tea 250 g 135')
    expect(item.name).toBe('Red Label Tea 250 g')
    expect(item.evidence.matchedProduct).toBe('Tea 250 g')
  })

  it('fixes a misread spelling without inventing a pack size', () => {
    const item = readLine('Britannia Goodday 30')
    expect(item.name).toBe('Britannia Good Day')
    expect(item.name).not.toMatch(/\d/)
    expect(item.evidence.nameKeptAsPrinted).toBe(false)
  })

  it('explains every row whose displayed name is not the lexicon name', () => {
    const parse = parseCatalogLines([
      { text: 'Surf Excel 1 kg 120', confidence: 90 },
      { text: 'Parle-G Biscuit 10', confidence: 90 },
      { text: 'Britannia Bread 45', confidence: 90 },
    ])
    for (const item of resolveItems(parse.items)) {
      expect(item.name).not.toBe(item.evidence.matchedProduct)
      expect(item.evidence.nameNote.length).toBeGreaterThan(10)
      // The reasoning stays inspectable rather than hidden.
      expect(item.evidence.signals.some((signal) => signal.startsWith('name:'))).toBe(true)
    }
  })

  it('leaves an unmatched row and its price completely alone', () => {
    const item = readLine('Zorblax Widget 1 kg 40')
    expect(item.matched).toBe(false)
    expect(item.name).toBe('Zorblax Widget 1 kg')
    expect(item.evidence.printedPackSize).toBe('1 kg')
    expect(item.evidence.lexiconPackSize).toBeNull()
  })
})
