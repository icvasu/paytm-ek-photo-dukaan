import { describe, expect, it } from 'vitest'
import { parseCatalogLines } from './parseCatalog.ts'
import type { OcrLine } from './ocr.ts'

function lines(...values: (string | [string, number])[]): OcrLine[] {
  return values.map((value) =>
    typeof value === 'string' ? { text: value, confidence: 88 } : { text: value[0], confidence: value[1] },
  )
}

describe('parseCatalogLines', () => {
  it('reads a printed rate card with dot leaders', () => {
    const result = parseCatalogLines(lines(
      'RATE CARD',
      'Masala Chai ........ 10',
      'Samosa ............. 15',
      'Water Bottle 1 L ... 20',
    ))
    expect(result.items.map((entry) => entry.name)).toEqual(['Masala Chai', 'Samosa', 'Water Bottle 1 L'])
    expect(result.items.map((entry) => entry.pricePaise)).toEqual([1000, 1500, 2000])
  })

  it('reads rupee prefixes, suffixes and /- notation', () => {
    const result = parseCatalogLines(lines(
      'Thums Up 750 ml ₹45',
      'Rs 28 Tata Salt 1 kg',
      'Parle-G 250 g 25/-',
      'Filter Coffee INR 25.50',
    ))
    expect(result.items).toHaveLength(4)
    expect(result.items.find((entry) => entry.name.includes('Thums'))?.pricePaise).toBe(4500)
    expect(result.items.find((entry) => entry.name.includes('Salt'))?.pricePaise).toBe(2800)
    expect(result.items.find((entry) => entry.name.includes('Parle'))?.pricePaise).toBe(2500)
    expect(result.items.find((entry) => entry.name.includes('Coffee'))?.pricePaise).toBe(2550)
  })

  it('repairs digit-shaped letters inside a price token', () => {
    const result = parseCatalogLines(lines('Maggi Masala 70 g ₹1O'))
    expect(result.items[0]?.pricePaise).toBe(1000)
  })

  it('drops header, total and contact rows', () => {
    const result = parseCatalogLines(lines(
      'MRP LIST 2024',
      'TOTAL 450',
      'Phone 9876543210',
      'GSTIN 36ABCDE1234F1Z5',
      'Date 12/04/2024 200',
      'Masala Chai 10',
    ))
    expect(result.items.map((entry) => entry.name)).toEqual(['Masala Chai'])
    expect(result.rejected.length).toBeGreaterThanOrEqual(4)
    for (const entry of result.rejected) expect(entry.reason).toBeTruthy()
  })

  it('returns nothing for a photo with no price-like text', () => {
    const result = parseCatalogLines(lines(
      'HAPPY BIRTHDAY',
      'to my dearest friend',
      'see you soon',
    ))
    expect(result.items).toHaveLength(0)
    expect(result.rejected).toHaveLength(3)
  })

  it('returns nothing for pure noise', () => {
    const result = parseCatalogLines(lines('@#$%^', '~~~~', 'IIIII', 'a', ''))
    expect(result.items).toHaveLength(0)
  })

  it('returns an empty outcome when OCR read no lines', () => {
    const result = parseCatalogLines([])
    expect(result.items).toHaveLength(0)
    expect(result.rejected).toHaveLength(0)
    expect(result.linesRead).toBe(0)
  })

  it('never emits a zero or negative price', () => {
    const result = parseCatalogLines(lines('Free sample 0', 'Chai -5', 'Water 0.00'))
    for (const entry of result.items) expect(entry.pricePaise).toBeGreaterThan(0)
  })

  it('rejects a name longer than a shelf label would ever be', () => {
    const long = `${'Extremely Long Product Name '.repeat(6)}99`
    const result = parseCatalogLines(lines(long))
    expect(result.items).toHaveLength(0)
  })

  it('clamps confidence into the stated band and always explains it', () => {
    const result = parseCatalogLines(lines(
      ['Masala Chai 10', 100],
      ['Samosa 15', 0],
      ['Water Bottle 20', 42],
    ))
    for (const entry of result.items) {
      expect(entry.confidencePct).toBeGreaterThanOrEqual(5)
      expect(entry.confidencePct).toBeLessThanOrEqual(95)
      expect(entry.basis.length).toBeGreaterThan(0)
    }
  })

  it('a clean high-confidence line outranks a low-confidence one', () => {
    const result = parseCatalogLines(lines(['Masala Chai ₹10', 96], ['Samosa 15', 30]))
    const chai = result.items.find((entry) => entry.name.includes('Chai'))
    const samosa = result.items.find((entry) => entry.name.includes('Samosa'))
    expect(chai!.confidencePct).toBeGreaterThan(samosa!.confidencePct)
  })

  it('keeps the better read when the same item appears twice', () => {
    const result = parseCatalogLines(lines(['Masala Chai 10', 40], ['Masala Chai 10', 95]))
    expect(result.items).toHaveLength(1)
    expect(result.items[0].confidencePct).toBeGreaterThan(50)
  })

  it('assigns categories from keyword rules and falls back to General', () => {
    const result = parseCatalogLines(lines('Masala Chai 10', 'Toor Dal 1 kg 168', 'Widget 99'))
    expect(result.items[0].category).toBe('Hot drinks')
    expect(result.items[1].category).toBe('Pulses')
    expect(result.items[2].category).toBe('General')
  })

  it('survives adversarial and very long input without throwing', () => {
    const hostile = lines(
      '₹₹₹₹₹₹₹₹',
      '999999999999999999',
      `${'x'.repeat(5000)} 10`,
      '<script>alert(1)</script> 50',
      '10 20 30 40 50 60',
      'नमक 1 किलो 28',
    )
    expect(() => parseCatalogLines(hostile)).not.toThrow()
    const result = parseCatalogLines(hostile)
    for (const entry of result.items) {
      expect(entry.pricePaise).toBeGreaterThan(0)
      expect(entry.name.length).toBeLessThanOrEqual(48)
    }
  })

  it('handles a thousand junk lines quickly', () => {
    const many = lines(...Array.from({ length: 1000 }, (_, index) => `Random text ${index} line`))
    const started = Date.now()
    parseCatalogLines(many)
    expect(Date.now() - started).toBeLessThan(1500)
  })
})
