import type { BasketLine, CatalogItem } from '../types/models.js'

export interface BasketCandidate {
  lines: BasketLine[]
  totalPaise: number
  /** Plausibility cost. Lower is a more likely real-world basket. */
  cost: number
  /** Posterior probability of this basket across every exact-sum basket found. */
  probability: number
  confidencePct: number
  rationale: string
}

export type BasketSolveStatus = 'solved' | 'ambiguous' | 'no_solution' | 'not_applicable'

export interface BasketSolution {
  status: BasketSolveStatus
  candidates: BasketCandidate[]
  /** Exact-sum baskets discovered inside the search budget. */
  solutionCount: number
  /** DFS nodes expanded. Reported so the number on screen is auditable. */
  nodesExplored: number
  /** True when the node budget stopped the search before it was exhaustive. */
  truncated: boolean
  explanation: string
}

export interface BasketSolveOptions {
  /** Distinct SKUs allowed in one basket. */
  maxDistinctItems?: number
  /** Units allowed for a single SKU. */
  maxQuantityPerItem?: number
  /** Units allowed across the whole basket. */
  maxTotalUnits?: number
  /** Hard ceiling on DFS nodes so the UI can never hang. */
  nodeBudget?: number
  /** Exact-sum baskets to keep before ranking. */
  solutionLimit?: number
  /** Ranked candidates handed back to the caller. */
  candidateLimit?: number
  /** Units already sold per SKU. Real demand data nudges the ranking. */
  unitsSoldBySku?: Record<string, number>
}

interface PriceGroup {
  pricePaise: number
  item: CatalogItem
  soldUnits: number
}

const DEFAULTS = {
  maxDistinctItems: 4,
  maxQuantityPerItem: 12,
  maxTotalUnits: 24,
  nodeBudget: 250_000,
  solutionLimit: 400,
  candidateLimit: 4,
}

/** Temperature of the softmax that turns plausibility cost into probability. */
const COST_TEMPERATURE = 1.15

/**
 * Amount alone can never prove a basket, so the top candidate is never shown
 * above this. Keeps the confidence number defensible.
 */
const MAX_CONFIDENCE_PCT = 92

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const next = x % y
    x = y
    y = next
  }
  return x
}

/**
 * Collapses the catalog to one representative per price point. Two items at the
 * same price are indistinguishable from the amount alone, so searching both
 * would multiply the combination count without adding information.
 */
function buildPriceGroups(items: CatalogItem[], unitsSoldBySku: Record<string, number>): PriceGroup[] {
  const byPrice = new Map<number, PriceGroup>()
  for (const item of items) {
    if (!item.available) continue
    if (!Number.isFinite(item.pricePaise) || item.pricePaise <= 0) continue
    const soldUnits = Math.max(0, unitsSoldBySku[item.id] ?? 0)
    const existing = byPrice.get(item.pricePaise)
    if (!existing || soldUnits > existing.soldUnits) {
      byPrice.set(item.pricePaise, { pricePaise: item.pricePaise, item, soldUnits })
    }
  }
  return [...byPrice.values()].sort((a, b) => b.pricePaise - a.pricePaise)
}

/**
 * Plausibility cost for a basket. Every term is a stated shop-floor assumption:
 * short baskets beat long ones, small quantities beat large ones, and items the
 * shop has actually sold beat items it has not.
 */
function basketCost(picks: { group: PriceGroup; quantity: number }[], maxSold: number): number {
  let cost = 0
  for (const pick of picks) {
    cost += 1
    cost += (pick.quantity - 1) * 0.34
    if (pick.quantity > 6) cost += 0.7
    if (maxSold > 0) cost -= 0.55 * (pick.group.soldUnits / maxSold)
  }
  return cost
}

function describe(picks: { group: PriceGroup; quantity: number }[]): string {
  const distinct = picks.length
  const units = picks.reduce((sum, pick) => sum + pick.quantity, 0)
  const sold = picks.filter((pick) => pick.group.soldUnits > 0).length
  const parts = [`${distinct} item${distinct === 1 ? '' : 's'}`, `${units} unit${units === 1 ? '' : 's'}`]
  if (sold) parts.push(`${sold} with prior sales`)
  return parts.join(' · ')
}

/**
 * Exhaustive bounded multi-subset-sum over catalog prices.
 *
 * Real search, not a lookup: it enumerates every combination of distinct price
 * points and quantities that sums exactly to `amountPaise`, inside explicit
 * bounds, then ranks what it found. Any amount is accepted, including amounts
 * with no solution.
 */
export function solveBasket(
  amountPaise: number,
  items: CatalogItem[],
  options: BasketSolveOptions = {},
): BasketSolution {
  const config = { ...DEFAULTS, ...options }
  const unitsSoldBySku = options.unitsSoldBySku ?? {}

  if (!Number.isFinite(amountPaise) || amountPaise <= 0 || !Number.isInteger(amountPaise)) {
    return {
      status: 'not_applicable',
      candidates: [],
      solutionCount: 0,
      nodesExplored: 0,
      truncated: false,
      explanation: 'Attribution needs a whole rupee-paise amount above zero.',
    }
  }

  const groups = buildPriceGroups(items, unitsSoldBySku)
  if (!groups.length) {
    return {
      status: 'not_applicable',
      candidates: [],
      solutionCount: 0,
      nodesExplored: 0,
      truncated: false,
      explanation: 'No available catalog item has a price yet, so there is nothing to solve against.',
    }
  }

  const cheapest = groups[groups.length - 1].pricePaise
  if (amountPaise < cheapest) {
    return {
      status: 'no_solution',
      candidates: [],
      solutionCount: 0,
      nodesExplored: 0,
      truncated: false,
      explanation: `₹${(amountPaise / 100).toLocaleString('en-IN')} is below the cheapest priced item, so no basket can add up to it.`,
    }
  }

  // Every basket total is a multiple of the gcd of all prices, so a non-multiple
  // is provably unreachable without any search.
  const priceGcd = groups.reduce((acc, group) => gcd(acc, group.pricePaise), 0)
  if (priceGcd > 1 && amountPaise % priceGcd !== 0) {
    return {
      status: 'no_solution',
      candidates: [],
      solutionCount: 0,
      nodesExplored: 0,
      truncated: false,
      explanation: `Every price in this catalog is a multiple of ₹${(priceGcd / 100).toLocaleString('en-IN')}, so ₹${(amountPaise / 100).toLocaleString('en-IN')} cannot be reached exactly.`,
    }
  }

  // Suffix minimum price lets the DFS prune as soon as the remainder can no
  // longer be paid for by any item still in scope.
  const suffixMin: number[] = new Array(groups.length + 1).fill(Number.POSITIVE_INFINITY)
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    suffixMin[index] = Math.min(suffixMin[index + 1], groups[index].pricePaise)
  }

  const maxSold = groups.reduce((max, group) => Math.max(max, group.soldUnits), 0)
  const solutions: { picks: { group: PriceGroup; quantity: number }[]; cost: number }[] = []
  const picks: { group: PriceGroup; quantity: number }[] = []
  let nodesExplored = 0
  let truncated = false

  const search = (index: number, remaining: number, unitsUsed: number) => {
    if (truncated) return
    if (solutions.length >= config.solutionLimit) {
      truncated = true
      return
    }
    if (remaining === 0) {
      solutions.push({ picks: picks.map((pick) => ({ ...pick })), cost: basketCost(picks, maxSold) })
      return
    }
    if (index >= groups.length) return
    if (picks.length >= config.maxDistinctItems) return
    if (unitsUsed >= config.maxTotalUnits) return
    if (remaining < suffixMin[index]) return

    nodesExplored += 1
    if (nodesExplored > config.nodeBudget) {
      truncated = true
      return
    }

    const group = groups[index]
    const unitCap = Math.min(
      config.maxQuantityPerItem,
      config.maxTotalUnits - unitsUsed,
      Math.floor(remaining / group.pricePaise),
    )
    for (let quantity = unitCap; quantity >= 1; quantity -= 1) {
      picks.push({ group, quantity })
      search(index + 1, remaining - group.pricePaise * quantity, unitsUsed + quantity)
      picks.pop()
      if (truncated) return
    }
    search(index + 1, remaining, unitsUsed)
  }

  search(0, amountPaise, 0)

  if (!solutions.length) {
    return {
      status: 'no_solution',
      candidates: [],
      solutionCount: 0,
      nodesExplored,
      truncated,
      explanation: truncated
        ? `Searched ${nodesExplored.toLocaleString('en-IN')} combinations without an exact match and hit the search limit. Add the items by hand.`
        : `No combination of up to ${config.maxDistinctItems} catalog items adds up to exactly ₹${(amountPaise / 100).toLocaleString('en-IN')}. Searched ${nodesExplored.toLocaleString('en-IN')} combinations.`,
    }
  }

  solutions.sort((a, b) => a.cost - b.cost)
  const bestCost = solutions[0].cost
  const weights = solutions.map((solution) => Math.exp(-(solution.cost - bestCost) / COST_TEMPERATURE))
  const weightSum = weights.reduce((sum, weight) => sum + weight, 0)

  const candidates: BasketCandidate[] = solutions.slice(0, config.candidateLimit).map((solution, position) => {
    const probability = weights[position] / weightSum
    return {
      lines: solution.picks.map((pick): BasketLine => ({
        skuId: pick.group.item.id,
        itemName: pick.group.item.name,
        quantity: pick.quantity,
        pricePaise: pick.group.pricePaise,
      })),
      totalPaise: amountPaise,
      cost: Math.round(solution.cost * 100) / 100,
      probability,
      confidencePct: Math.max(1, Math.min(MAX_CONFIDENCE_PCT, Math.round(probability * 100))),
      rationale: describe(solution.picks),
    }
  })

  const top = candidates[0]
  const status: BasketSolveStatus = top.probability >= 0.55 ? 'solved' : 'ambiguous'
  const searchScope = truncated
    ? `${nodesExplored.toLocaleString('en-IN')} combinations (search limit reached, so more baskets may exist)`
    : `${nodesExplored.toLocaleString('en-IN')} combinations`

  return {
    status,
    candidates,
    solutionCount: solutions.length,
    nodesExplored,
    truncated,
    explanation: status === 'solved'
      ? `${solutions.length} basket${solutions.length === 1 ? '' : 's'} add up to exactly ₹${(amountPaise / 100).toLocaleString('en-IN')} out of ${searchScope}. The top one is the most plausible.`
      : `${solutions.length} different baskets add up to exactly ₹${(amountPaise / 100).toLocaleString('en-IN')} out of ${searchScope}. The amount alone cannot separate them, so pick the right one.`,
  }
}

/** Units sold per SKU from confirmed baskets. Real data for the ranking prior. */
export function unitsSoldBySku(assignments: { lines: BasketLine[] }[]): Record<string, number> {
  const totals: Record<string, number> = {}
  for (const assignment of assignments ?? []) {
    for (const line of assignment.lines ?? []) {
      totals[line.skuId] = (totals[line.skuId] ?? 0) + line.quantity
    }
  }
  return totals
}
