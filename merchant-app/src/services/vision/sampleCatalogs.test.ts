/**
 * Guards the two shipped sample catalogs against the amounts a judge is most
 * likely to type. The claim being tested is not "every amount resolves" — it is
 * that every amount gets an honest answer, and that the demo amounts resolve.
 */
import { describe, expect, it } from 'vitest'
import { solveBasket } from '../../domain/basketSolver.js'
import { SAMPLE_SHOPS } from './VisionService.js'

const JUDGE_AMOUNTS = [1, 10, 22, 25, 45, 73, 100, 211, 500, 9999, 45.5]

for (const shop of SAMPLE_SHOPS) {
  describe(`sample catalog: ${shop.label}`, () => {
    it('answers every judge-typed amount without throwing', () => {
      const report: string[] = []
      for (const rupees of JUDGE_AMOUNTS) {
        const paise = Math.round(rupees * 100)
        const solution = solveBasket(paise, shop.items)
        // Either a basket that sums exactly, or an explicit refusal with a reason.
        if (solution.candidates.length) {
          const total = solution.candidates[0].lines
            .reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)
          expect(total).toBe(paise)
        } else {
          expect(solution.explanation.length).toBeGreaterThan(20)
        }
        report.push(`₹${rupees} → ${solution.status} (${solution.solutionCount} exact)`)
      }
      // eslint-disable-next-line no-console
      console.log(`\n[${shop.label}]\n${report.join('\n')}\n`)
    })

    it('never suggests an unavailable item', () => {
      const unavailable = new Set(shop.items.filter((item) => !item.available).map((item) => item.id))
      for (const rupees of JUDGE_AMOUNTS) {
        const solution = solveBasket(Math.round(rupees * 100), shop.items)
        for (const candidate of solution.candidates) {
          for (const line of candidate.lines) {
            expect(unavailable.has(line.skuId)).toBe(false)
          }
        }
      }
    })

    it('ranks the simplest basket first for the ₹45 demo amount', () => {
      const solution = solveBasket(4500, shop.items)
      expect(solution.candidates.length).toBeGreaterThan(0)
      const top = solution.candidates[0]
      // The demo narrative depends on the shortest basket winning the ranking.
      // Confidence is deliberately NOT asserted high: on the rate card several
      // baskets sum to ₹45, and the product's whole claim is that it says so.
      const units = top.lines.reduce((sum, line) => sum + line.quantity, 0)
      expect(units).toBe(1)
      // eslint-disable-next-line no-console
      console.log(`\n[${shop.label} ₹45] top=${top.lines.map((l) => `${l.quantity}× ${l.itemName}`).join(', ')} `
        + `confidence=${top.confidencePct}% status=${solution.status} exactSums=${solution.solutionCount}\n`)
    })

    it('refuses an amount below the cheapest item instead of inventing one', () => {
      const cheapest = Math.min(...shop.items.filter((i) => i.available).map((i) => i.pricePaise))
      const solution = solveBasket(cheapest - 1, shop.items)
      expect(solution.candidates).toHaveLength(0)
      expect(solution.status).toBe('no_solution')
    })
  })
}
