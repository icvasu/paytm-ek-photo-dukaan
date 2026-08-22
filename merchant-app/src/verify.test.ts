/**
 * Adversarial verification run.
 *
 * Prints the exact strings and results reported to the judges, so the claims in
 * docs/PAYTM_INTEGRATION.md are reproducible with one command rather than
 * taken on trust.
 */
import { describe, expect, it } from 'vitest'
import { collectIntent, parseUpiIntent, shopIntent } from './services/paytm/upi.ts'
import { solveBasket } from './domain/basketSolver.ts'
import { MEENA_SHELF_ITEMS } from './services/vision/VisionService.ts'
import { parseCatalogLines } from './services/vision/parseCatalog.ts'
import { resolveItems } from './services/vision/resolveItems.ts'
import { estimateDemand } from './intelligence/demand.ts'

const SHOP = 'Meena Kirana & General Store'

describe('UPI URIs shipped in the demo', () => {
  it('static shop QR decodes to a valid upi://pay with no amount', () => {
    const intent = shopIntent(SHOP)
    // eslint-disable-next-line no-console
    console.log(`\n[STATIC SHOP QR]\n${intent.uri}\n`)
    const parsed = parseUpiIntent(intent.uri)!
    expect(parsed.pa).toBe('example.merchant@upi')
    expect(parsed.pn).toBe(SHOP)
    expect(parsed.cu).toBe('INR')
    expect(parsed.am).toBeUndefined()
    expect(intent.usesPlaceholderVpa).toBe(true)
  })

  it('₹45 dynamic QR decodes to a valid upi://pay with am=45.00', () => {
    const intent = collectIntent(SHOP, 45, { note: 'Counter payment', txnRef: 'EPDDEMO45' })
    // eslint-disable-next-line no-console
    console.log(`\n[DYNAMIC ₹45 QR]\n${intent.uri}\n`)
    const parsed = parseUpiIntent(intent.uri)!
    expect(parsed.pa).toBe('example.merchant@upi')
    expect(parsed.pn).toBe(SHOP)
    expect(parsed.am).toBe('45.00')
    expect(parsed.cu).toBe('INR')
    expect(parsed.tn).toBe('Counter payment')
    expect(parsed.tr).toBe('EPDDEMO45')
  })
})

describe('basket inference against adversarial amounts', () => {
  const amounts = [45, 73, 211, 1, 9999, 0, 45.5]

  it('answers every amount without throwing or inventing a basket', () => {
    const lines: string[] = []
    for (const rupees of amounts) {
      const paise = Math.round(rupees * 100)
      const solution = solveBasket(paise, MEENA_SHELF_ITEMS)
      const top = solution.candidates[0]
      const summary = top
        ? `${top.lines.map((line) => `${line.quantity}x ${line.itemName}`).join(', ')} @ ${top.confidencePct}%`
        : '(no basket suggested)'
      lines.push(
        `₹${rupees} → status=${solution.status} exactSums=${solution.solutionCount} `
        + `nodes=${solution.nodesExplored} | ${summary}`,
      )

      // Whatever the status, any basket returned must sum to exactly the amount.
      for (const candidate of solution.candidates) {
        const total = candidate.lines.reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)
        expect(total, `₹${rupees}`).toBe(paise)
      }
      // A no-solution answer must never come with a suggestion attached.
      if (solution.status === 'no_solution' || solution.status === 'not_applicable') {
        expect(solution.candidates, `₹${rupees}`).toHaveLength(0)
        expect(solution.explanation.length, `₹${rupees}`).toBeGreaterThan(10)
      }
    }
    // eslint-disable-next-line no-console
    console.log(`\n[BASKET INFERENCE]\n${lines.join('\n')}\n`)
  })

  it('rejects amounts that cannot be a basket rather than guessing', () => {
    expect(solveBasket(0, MEENA_SHELF_ITEMS).status).toBe('not_applicable')
    expect(solveBasket(-100, MEENA_SHELF_ITEMS).status).toBe('not_applicable')
    // Every shelf price is a whole number of rupees, so ₹45.50 is unreachable.
    expect(solveBasket(4550, MEENA_SHELF_ITEMS).status).toBe('no_solution')
    // Below the cheapest item.
    expect(solveBasket(100, MEENA_SHELF_ITEMS).status).toBe('no_solution')
  })

  it('stays responsive on a large amount', () => {
    const startedAt = Date.now()
    const solution = solveBasket(999_900, MEENA_SHELF_ITEMS)
    const elapsed = Date.now() - startedAt
    // eslint-disable-next-line no-console
    console.log(`\n[₹9999 TIMING] ${elapsed}ms, status=${solution.status}, nodes=${solution.nodesExplored}\n`)
    expect(elapsed).toBeLessThan(3000)
  })
})

describe('extraction does not fabricate a catalog', () => {
  it('produces zero items from text with no prices', () => {
    // What OCR returns from a photo of a wall, a face or a blurry shelf.
    const noise = [
      'hjkl qwerty', '~~~~~', 'Thank you visit again', 'GSTIN 27AAAPL1234C',
      'MRP', 'Total', '9876543210', '', '||| ---',
    ].map((text) => ({ text, confidence: 41 }))

    const parse = parseCatalogLines(noise)
    // eslint-disable-next-line no-console
    console.log(
      `\n[UNKNOWN IMAGE] lines=${parse.linesRead} accepted=${parse.items.length} `
      + `rejected=${parse.rejected.length}\n`
      + parse.rejected.map((line) => `  "${line.text}" → ${line.reason}`).join('\n') + '\n',
    )
    expect(parse.items).toHaveLength(0)
    // Every skipped line carries a stated reason.
    expect(parse.rejected.every((line) => line.reason.length > 5)).toBe(true)
  })

  it('produces zero items from an empty read', () => {
    expect(parseCatalogLines([]).items).toHaveLength(0)
  })

  it('keeps an unrecognised but genuinely priced row instead of renaming it', () => {
    const parse = parseCatalogLines([{ text: 'Zorblax Widget 40', confidence: 88 }])
    expect(parse.items).toHaveLength(1)
    const resolved = resolveItems(parse.items)
    expect(resolved[0].matched).toBe(false)
    expect(resolved[0].name).toContain('Zorblax')
    // eslint-disable-next-line no-console
    console.log(`\n[UNMATCHED ROW] "${resolved[0].name}" @ ${resolved[0].confidencePct}% — ${resolved[0].evidence.signals.join('; ')}\n`)
  })

  it('resolves a noisy but real product line to the canonical name', () => {
    const parse = parseCatalogLines([{ text: 'Aashinvaad Atta 5kg   Rs 295', confidence: 82 }])
    const resolved = resolveItems(parse.items)
    expect(resolved[0].matched).toBe(true)
    expect(resolved[0].name).toContain('Aashirvaad')
    expect(resolved[0].pricePaise).toBe(29500)
    // eslint-disable-next-line no-console
    console.log(
      `\n[MATCHED ROW] "${parse.items[0].sourceLine}" → ${resolved[0].name} @ ₹${resolved[0].pricePaise / 100}`
      + ` (${resolved[0].confidencePct}%) via "${resolved[0].evidence.matchedAlias}"\n`,
    )
  })
})

describe('demand model degrades honestly with no data', () => {
  it('reports no rate rather than a zero forecast when nothing has sold', () => {
    const report = estimateDemand({
      items: MEENA_SHELF_ITEMS,
      assignments: [],
      transactions: [],
      nowIso: '2026-08-22T10:00:00.000Z',
    })
    for (const estimate of report.estimates) {
      expect(estimate.quality).toBe('none')
      expect(estimate.ratePerDay).toBeNull()
      expect(estimate.daysOfCover).toBeNull()
      expect(estimate.notes.length).toBeGreaterThan(0)
    }
  })
})
