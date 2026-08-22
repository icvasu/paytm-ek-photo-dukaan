import { describe, expect, it } from 'vitest'
import type { OcrLine } from './ocr.js'
import { parseInvoiceLines } from './parseInvoice.js'

const lines = (...texts: string[]): OcrLine[] => texts.map((text) => ({ text, confidence: 88 }))

describe('parseInvoiceLines', () => {
  it('reads a four-column bill row and verifies its arithmetic', () => {
    const out = parseInvoiceLines(lines('Thums Up 750 ml 24 36.00 864.00'))
    expect(out.lines).toHaveLength(1)
    const [row] = out.lines
    // The pack size must stay in the name, not be mistaken for the quantity.
    expect(row.itemName).toBe('Thums Up 750 ml')
    expect(row.quantity).toBe(24)
    expect(row.unitCostPaise).toBe(3600)
    expect(row.lineTotalPaise).toBe(86400)
    expect(row.arithmeticVerified).toBe(true)
  })

  it('reads the "qty x rate" notation', () => {
    const out = parseInvoiceLines(lines('Parle-G Biscuit 48 x 7.50'))
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0].quantity).toBe(48)
    expect(out.lines[0].unitCostPaise).toBe(750)
  })

  it('reads a two-column quantity and rate', () => {
    const out = parseInvoiceLines(lines('Mango Juice 12 39.00'))
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0].quantity).toBe(12)
    expect(out.lines[0].unitCostPaise).toBe(3900)
    expect(out.lines[0].arithmeticVerified).toBe(false)
  })

  it('rejects a row with only one number instead of guessing a quantity', () => {
    const out = parseInvoiceLines(lines('Limca 750 ml 3200'))
    expect(out.lines).toHaveLength(0)
    expect(out.rejected.some((row) => /quantity/i.test(row.reason))).toBe(true)
  })

  it('skips column headers, totals and tax rows', () => {
    const out = parseInvoiceLines(lines(
      'Sr No Particulars Qty Rate Amount',
      'Thums Up 750 ml 24 36.00 864.00',
      'CGST 9% 77.76',
      'Grand Total 941.76',
    ))
    expect(out.lines.map((row) => row.itemName)).toEqual(['Thums Up 750 ml'])
    expect(out.readTotalPaise).toBe(94176)
  })

  it('reads the supplier name and phone from the header', () => {
    const out = parseInvoiceLines(lines(
      'Sharma Traders',
      'Kukatpally, Hyderabad 500072',
      'Mobile 9876544110',
      'Thums Up 750 ml 24 36.00 864.00',
    ))
    expect(out.supplierName).toBe('Sharma Traders')
    expect(out.supplierPhone).toBe('9876544110')
  })

  it('repairs OCR letter-for-digit slips inside the figures', () => {
    // "1O" for 10 and "26O.OO" for 260.00 are classic Tesseract confusions.
    const out = parseInvoiceLines(lines('Aashirvaad Atta 5 kg 1O 26O.OO 26OO.OO'))
    expect(out.lines).toHaveLength(1)
    expect(out.lines[0].quantity).toBe(10)
    expect(out.lines[0].unitCostPaise).toBe(26000)
    expect(out.lines[0].arithmeticVerified).toBe(true)
  })

  it('reports a computed total that a caller can compare with the printed one', () => {
    const out = parseInvoiceLines(lines(
      'Thums Up 750 ml 24 36.00 864.00',
      'Parle-G Biscuit 48 7.50 360.00',
    ))
    expect(out.lines).toHaveLength(2)
    expect(out.computedTotalPaise).toBe(86400 + 36000)
  })

  it('returns nothing at all for a photo with no bill in it', () => {
    const out = parseInvoiceLines(lines('HAPPY BIRTHDAY', 'Best wishes'))
    expect(out.lines).toHaveLength(0)
  })
})
