import { describe, expect, it } from 'vitest'
import {
  buildUpiIntent,
  collectIntent,
  createTxnRef,
  formatUpiAmount,
  isValidVpa,
  MAX_UPI_AMOUNT_RUPEES,
  parseUpiIntent,
  PLACEHOLDER_VPA,
  sanitizeTxnRef,
  shopIntent,
  UpiIntentError,
} from './upi.ts'

const SHOP = 'Meena Kirana & General Store'

describe('isValidVpa', () => {
  it('accepts real-world handle shapes', () => {
    for (const vpa of ['meenakirana@paytm', 'a.b-c_d@okhdfcbank', '9876543210@ybl', 'x1@upi']) {
      expect(isValidVpa(vpa)).toBe(true)
    }
  })

  it('rejects malformed handles rather than encoding a dead link', () => {
    for (const vpa of ['', 'nohandle', '@paytm', 'a@', 'a@@b', 'a b@paytm', '.lead@paytm', 'trail.@paytm', 'a@1bank']) {
      expect(isValidVpa(vpa)).toBe(false)
    }
  })
})

describe('formatUpiAmount', () => {
  it('always emits exactly two decimal places', () => {
    expect(formatUpiAmount(45)).toBe('45.00')
    expect(formatUpiAmount(45.5)).toBe('45.50')
    expect(formatUpiAmount(45.05)).toBe('45.05')
    expect(formatUpiAmount(1)).toBe('1.00')
    expect(formatUpiAmount(9999)).toBe('9999.00')
  })
})

describe('buildUpiIntent', () => {
  it('builds a spec-shaped URI that round-trips through a parser', () => {
    const intent = buildUpiIntent({
      vpa: 'meenakirana@paytm',
      payeeName: SHOP,
      amountRupees: 45,
      note: 'Counter payment',
      txnRef: 'EPD-TEST-001',
    })
    const parsed = parseUpiIntent(intent.uri)
    expect(parsed).not.toBeNull()
    expect(parsed).toMatchObject({
      pa: 'meenakirana@paytm',
      pn: SHOP,
      am: '45.00',
      cu: 'INR',
      tn: 'Counter payment',
      tr: 'EPDTEST001',
    })
  })

  it('percent-encodes the ampersand in the shop name so the query cannot split', () => {
    const intent = buildUpiIntent({ vpa: 'a@paytm', payeeName: SHOP, amountRupees: 45 })
    expect(intent.uri).toContain('pn=Meena%20Kirana%20%26%20General%20Store')
    expect(parseUpiIntent(intent.uri)?.pn).toBe(SHOP)
  })

  it('omits am for a static shop QR', () => {
    const intent = shopIntent(SHOP, 'a@paytm')
    expect(intent.isStatic).toBe(true)
    expect(intent.uri).not.toContain('am=')
    expect(parseUpiIntent(intent.uri)?.cu).toBe('INR')
  })

  it('never emits an empty parameter', () => {
    const intent = buildUpiIntent({ vpa: 'a@paytm', payeeName: SHOP, note: '   ', txnRef: '---' })
    expect(intent.uri).not.toMatch(/=(&|$)/)
  })

  it('rejects amounts UPI apps would refuse instead of encoding them', () => {
    const bad = [0, -5, 0.5, 45.555, Number.NaN, Number.POSITIVE_INFINITY, MAX_UPI_AMOUNT_RUPEES + 1]
    for (const amountRupees of bad) {
      expect(() => buildUpiIntent({ vpa: 'a@paytm', payeeName: SHOP, amountRupees }))
        .toThrow(UpiIntentError)
    }
  })

  it('accepts the boundary amounts', () => {
    expect(buildUpiIntent({ vpa: 'a@paytm', payeeName: SHOP, amountRupees: 1 }).amount).toBe('1.00')
    expect(buildUpiIntent({ vpa: 'a@paytm', payeeName: SHOP, amountRupees: MAX_UPI_AMOUNT_RUPEES }).amount)
      .toBe('100000.00')
  })

  it('rejects an invalid VPA', () => {
    expect(() => buildUpiIntent({ vpa: 'not-a-vpa', payeeName: SHOP })).toThrow(UpiIntentError)
  })

  it('clamps the note to the 50-character NPCI limit', () => {
    const intent = buildUpiIntent({ vpa: 'a@paytm', payeeName: SHOP, note: 'x'.repeat(120) })
    expect(parseUpiIntent(intent.uri)?.tn).toHaveLength(50)
  })

  it('strips newlines that would corrupt a QR payload', () => {
    const intent = buildUpiIntent({ vpa: 'a@paytm', payeeName: 'Shop\nName\t2', amountRupees: 10 })
    expect(intent.payeeName).toBe('Shop Name 2')
  })

  it('flags the placeholder VPA so the UI can say the QR is not a real account', () => {
    expect(buildUpiIntent({ payeeName: SHOP }).usesPlaceholderVpa).toBe(true)
    expect(buildUpiIntent({ payeeName: SHOP }).vpa).toBe(PLACEHOLDER_VPA)
    expect(buildUpiIntent({ vpa: 'real@paytm', payeeName: SHOP }).usesPlaceholderVpa).toBe(false)
  })
})

describe('transaction references', () => {
  it('keeps only uppercase alphanumerics within the 35-character limit', () => {
    expect(sanitizeTxnRef('epd-2026/08#22 abc')).toBe('EPD20260822ABC')
    expect(sanitizeTxnRef('x'.repeat(80))).toHaveLength(35)
  })

  it('generates distinct references', () => {
    const refs = new Set(Array.from({ length: 200 }, () => createTxnRef()))
    expect(refs.size).toBe(200)
  })
})

describe('collectIntent', () => {
  it('attaches a reference automatically for reconciliation', () => {
    const intent = collectIntent(SHOP, 45, { vpa: 'a@paytm', note: 'Chai and samosa' })
    expect(intent.txnRef).toBeTruthy()
    expect(parseUpiIntent(intent.uri)?.am).toBe('45.00')
  })
})

describe('parseUpiIntent', () => {
  it('returns null for anything that is not a upi pay link', () => {
    for (const value of ['', 'https://paytm.com', 'upi://collect?pa=a@b']) {
      expect(parseUpiIntent(value)).toBeNull()
    }
  })
})
