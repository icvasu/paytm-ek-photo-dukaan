import { describe, expect, it } from 'vitest'
import { solveBasket, unitsSoldBySku } from './basketSolver.ts'
import { MEENA_SHELF_ITEMS } from '../services/vision/VisionService.ts'
import type { CatalogItem } from '../types/models.ts'

function item(id: string, name: string, pricePaise: number, available = true): CatalogItem {
  return {
    id,
    name,
    pricePaise,
    available,
    stockFlag: available ? 'in_stock' : 'out',
    stockLabel: available ? 'In stock' : 'Not available',
    category: 'Test',
  }
}

const shelf = MEENA_SHELF_ITEMS

describe('solveBasket', () => {
  it('finds the single-item basket for an exact catalog price', () => {
    const result = solveBasket(4500, shelf)
    expect(result.status).not.toBe('no_solution')
    const lines = result.candidates[0].lines
    expect(lines.reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)).toBe(4500)
  })

  it('every returned candidate sums to exactly the requested amount', () => {
    for (const amount of [1400, 2500, 4500, 7300, 9900, 21100, 45600, 100000]) {
      const result = solveBasket(amount, shelf)
      for (const candidate of result.candidates) {
        const total = candidate.lines.reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)
        expect(total).toBe(amount)
        expect(candidate.totalPaise).toBe(amount)
      }
    }
  })

  it('reports no_solution instead of inventing a basket', () => {
    // Every shelf price is a multiple of 100 paise, so ₹73.45 is unreachable.
    const result = solveBasket(7345, shelf)
    expect(result.status).toBe('no_solution')
    expect(result.candidates).toHaveLength(0)
    expect(result.explanation).toMatch(/cannot be reached|no combination/i)
  })

  it('proves unreachable amounts via the price gcd without searching', () => {
    const catalog = [item('a', 'A', 1000), item('b', 'B', 2500)]
    const result = solveBasket(1234, catalog)
    expect(result.status).toBe('no_solution')
    expect(result.nodesExplored).toBe(0)
  })

  it('solves ₹73 against a catalog that can actually make ₹73', () => {
    const catalog = [item('a', 'Chai', 1000), item('b', 'Samosa', 1500), item('c', 'Water', 2000), item('d', 'Combo', 2300)]
    const result = solveBasket(7300, catalog)
    expect(result.candidates.length).toBeGreaterThan(0)
    for (const candidate of result.candidates) {
      expect(candidate.lines.reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)).toBe(7300)
    }
  })

  it('flags ambiguity when many baskets hit the same amount', () => {
    const result = solveBasket(21100, shelf)
    if (result.status !== 'no_solution') {
      expect(result.solutionCount).toBeGreaterThan(0)
      if (result.solutionCount > 3) expect(result.status).toBe('ambiguous')
    }
  })

  it('never reports a confidence above the stated ceiling', () => {
    for (let rupees = 1; rupees <= 600; rupees += 1) {
      const result = solveBasket(rupees * 100, shelf)
      for (const candidate of result.candidates) {
        expect(candidate.confidencePct).toBeGreaterThanOrEqual(1)
        expect(candidate.confidencePct).toBeLessThanOrEqual(92)
      }
    }
  })

  it('candidate probabilities are ordered and bounded', () => {
    const result = solveBasket(19900, shelf)
    const probabilities = result.candidates.map((candidate) => candidate.probability)
    for (let index = 1; index < probabilities.length; index += 1) {
      expect(probabilities[index]).toBeLessThanOrEqual(probabilities[index - 1] + 1e-9)
    }
    for (const probability of probabilities) {
      expect(probability).toBeGreaterThan(0)
      expect(probability).toBeLessThanOrEqual(1)
    }
  })

  it('returns not_applicable for an empty catalog', () => {
    const result = solveBasket(4500, [])
    expect(result.status).toBe('not_applicable')
    expect(result.candidates).toHaveLength(0)
  })

  it('returns not_applicable when every item is hidden or unpriced', () => {
    const catalog = [item('a', 'Hidden', 1000, false), item('b', 'Free', 0)]
    expect(solveBasket(1000, catalog).status).toBe('not_applicable')
  })

  it('rejects absurd, negative and non-integer amounts without throwing', () => {
    for (const amount of [0, -1, -999999, 12.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = solveBasket(amount, shelf)
      expect(result.status).toBe('not_applicable')
      expect(result.candidates).toHaveLength(0)
    }
  })

  it('stays inside its node budget on a hostile amount', () => {
    const catalog = Array.from({ length: 24 }, (_, index) => item(`i${index}`, `Item ${index}`, (index + 1) * 100))
    const result = solveBasket(999_999_99, catalog, { nodeBudget: 50_000 })
    expect(result.nodesExplored).toBeLessThanOrEqual(50_001)
  })

  it('finishes quickly for a large amount over a wide catalog', () => {
    const catalog = Array.from({ length: 30 }, (_, index) => item(`i${index}`, `Item ${index}`, (index + 1) * 137))
    const started = Date.now()
    solveBasket(500_00, catalog)
    expect(Date.now() - started).toBeLessThan(2000)
  })

  it('never exceeds the configured basket bounds', () => {
    for (let rupees = 1; rupees <= 400; rupees += 7) {
      const result = solveBasket(rupees * 100, shelf, { maxDistinctItems: 3, maxQuantityPerItem: 5, maxTotalUnits: 9 })
      for (const candidate of result.candidates) {
        expect(candidate.lines.length).toBeLessThanOrEqual(3)
        const units = candidate.lines.reduce((sum, line) => sum + line.quantity, 0)
        expect(units).toBeLessThanOrEqual(9)
        for (const line of candidate.lines) expect(line.quantity).toBeLessThanOrEqual(5)
      }
    }
  })

  it('never repeats the same SKU twice inside one candidate', () => {
    for (let rupees = 10; rupees <= 300; rupees += 3) {
      for (const candidate of solveBasket(rupees * 100, shelf).candidates) {
        const ids = candidate.lines.map((line) => line.skuId)
        expect(new Set(ids).size).toBe(ids.length)
      }
    }
  })

  it('excludes hidden items from every candidate', () => {
    const hidden = new Set(shelf.filter((entry) => !entry.available).map((entry) => entry.id))
    expect(hidden.size).toBeGreaterThan(0)
    for (let rupees = 10; rupees <= 300; rupees += 1) {
      for (const candidate of solveBasket(rupees * 100, shelf).candidates) {
        for (const line of candidate.lines) expect(hidden.has(line.skuId)).toBe(false)
      }
    }
  })

  it('lets real sales history reorder equally-sized baskets', () => {
    const catalog = [item('slow', 'Slow mover', 2000), item('fast', 'Fast mover', 2000), item('other', 'Other', 3000)]
    const result = solveBasket(2000, catalog, { unitsSoldBySku: { fast: 40 } })
    expect(result.candidates[0].lines[0].skuId).toBe('fast')
  })

  it('derives units sold from confirmed baskets', () => {
    const totals = unitsSoldBySku([
      { lines: [{ skuId: 'a', itemName: 'A', quantity: 2, pricePaise: 100 }] },
      { lines: [{ skuId: 'a', itemName: 'A', quantity: 3, pricePaise: 100 }] },
    ])
    expect(totals.a).toBe(5)
  })

  it('tolerates a catalog carrying junk values', () => {
    const junk = [
      { ...item('a', 'A', Number.NaN) },
      { ...item('b', 'B', -500) },
      { ...item('c', 'C'.repeat(400), 1000) },
      { ...item('d', 'D', 1000) },
    ]
    const result = solveBasket(2000, junk)
    expect(result.candidates.every((candidate) => candidate.lines.every((line) => line.pricePaise > 0))).toBe(true)
  })
})
