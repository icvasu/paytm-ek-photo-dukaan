import type { BasketAssignment, CatalogItem, SupplierProfile, Transaction } from '../types/models.js'

/**
 * Demand estimation and restock timing.
 *
 * The model is deliberately simple and fully stated on screen: an exponentially
 * weighted moving average of daily units sold, then on-hand divided by that
 * rate to get days of cover. It is not Bayesian and does not claim to be. Every
 * number it produces can be recomputed by hand from the inputs it reports.
 */

/** Half-life in days. Sales a week old carry a quarter of today's weight. */
const HALF_LIFE_DAYS = 3.5
/** Below this many observed units the rate is noise, and we say so. */
const MIN_UNITS_FOR_RATE = 2
/** Below this many days of history the rate is noise, and we say so. */
const MIN_DAYS_OF_HISTORY = 2
/** Reorder when cover drops under this. */
const COVER_THRESHOLD_DAYS = 4

export type DemandQuality = 'sufficient' | 'sparse' | 'none'

export interface DemandEstimate {
  skuId: string
  itemName: string
  /** EWMA units per day. Null when there is not enough evidence. */
  ratePerDay: number | null
  /** Plain mean units/day over the window, for comparison. */
  meanPerDay: number | null
  /** Units attributed to this SKU from confirmed baskets. */
  observedUnits: number
  /** Days between the first and last observed sale, inclusive. */
  observationDays: number
  /** Distinct days on which this SKU sold at least one unit. */
  activeDays: number
  /** Midpoint of the on-hand estimate, after subtracting attributed sales. */
  onHandEstimate: number
  onHandLow: number
  onHandHigh: number
  /** onHand / ratePerDay. Null whenever the rate is null. */
  daysOfCover: number | null
  needsReorder: boolean
  quality: DemandQuality
  /** Why the number is what it is, and where it is weak. */
  notes: string[]
}

export interface DemandModelInputs {
  halfLifeDays: number
  /** Weight multiplier per day of age, derived from the half-life. */
  dailyDecay: number
  coverThresholdDays: number
  /** Days of daily buckets the EWMA ran over. */
  windowDays: number
  /** Confirmed baskets available to attribute units from. */
  attributedBaskets: number
  /** Successful payments with no basket attached yet. */
  unattributedPayments: number
}

export interface DemandReport {
  estimates: DemandEstimate[]
  inputs: DemandModelInputs
}

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

function daysBetween(fromKey: string, toKey: string): number {
  const from = Date.parse(`${fromKey}T00:00:00Z`)
  const to = Date.parse(`${toKey}T00:00:00Z`)
  if (!Number.isFinite(from) || !Number.isFinite(to)) return 0
  return Math.round((to - from) / 86_400_000)
}

/** Visual stock range the merchant photographed, e.g. "12–18 packs". */
function visualRange(item: CatalogItem): [number, number] {
  const values = item.stockLabel.match(/\d+/g)?.map(Number) ?? []
  if (values.length >= 2) return [values[0], values[1]]
  if (values.length === 1) return [values[0], values[0] + 3]
  if (item.stockFlag === 'out') return [0, 0]
  if (item.stockFlag === 'low') return [2, 5]
  // No count was read from the photo, so the band has to be wide and honest.
  return [6, 14]
}

/**
 * Weight multiplier per day of age. A sale `halfLifeDays` old is worth exactly
 * half a sale made today, because decay^halfLife = 0.5 by construction.
 */
export function dailyDecayForHalfLife(halfLifeDays: number): number {
  return Math.pow(2, -1 / halfLifeDays)
}

/**
 * Exponentially weighted demand rate in units per day.
 *
 * `dailyUnits` is oldest-first, with the last entry being today. This is a
 * normalised weighted mean — the weights are divided by their own sum — rather
 * than the usual `s = a*x + (1-a)*s` recursion, which leaves the seed value
 * undiscounted and would report a stale burst of sales as current demand.
 */
export function exponentiallyWeightedRate(dailyUnits: number[], dailyDecay: number): number {
  if (!dailyUnits.length) return 0
  const lastIndex = dailyUnits.length - 1
  let weightedSum = 0
  let weightTotal = 0
  for (let index = 0; index <= lastIndex; index += 1) {
    const ageDays = lastIndex - index
    const weight = Math.pow(dailyDecay, ageDays)
    weightedSum += weight * dailyUnits[index]
    weightTotal += weight
  }
  return weightTotal > 0 ? weightedSum / weightTotal : 0
}

/**
 * Builds a demand estimate per catalog item.
 *
 * Sales are only counted from baskets a merchant confirmed, so the rate is
 * grounded in attributed payments rather than in total collections.
 */
export function estimateDemand(input: {
  items: CatalogItem[]
  assignments: BasketAssignment[]
  transactions: Transaction[]
  supplier?: SupplierProfile | null
  nowIso: string
}): DemandReport {
  const dailyDecay = dailyDecayForHalfLife(HALF_LIFE_DAYS)
  const todayKey = dayKey(input.nowIso)
  const transactionDate = new Map(input.transactions.map((txn) => [txn.id, dayKey(txn.createdAt)]))

  // SKU → day → units, from confirmed baskets only.
  const unitsBySkuDay = new Map<string, Map<string, number>>()
  let attributedBaskets = 0
  for (const assignment of input.assignments ?? []) {
    const day = transactionDate.get(assignment.transactionId)
    if (!day) continue
    attributedBaskets += 1
    for (const line of assignment.lines ?? []) {
      const byDay = unitsBySkuDay.get(line.skuId) ?? new Map<string, number>()
      byDay.set(day, (byDay.get(day) ?? 0) + line.quantity)
      unitsBySkuDay.set(line.skuId, byDay)
    }
  }

  const successfulPayments = input.transactions.filter((txn) => txn.status === 'success').length
  const attributedIds = new Set((input.assignments ?? []).map((assignment) => assignment.transactionId))
  const unattributedPayments = input.transactions
    .filter((txn) => txn.status === 'success' && !attributedIds.has(txn.id)).length

  // The EWMA window starts at the earliest attributed sale so that a quiet day
  // in the middle correctly pulls the rate down.
  let earliestKey = todayKey
  for (const byDay of unitsBySkuDay.values()) {
    for (const day of byDay.keys()) if (day < earliestKey) earliestKey = day
  }
  const windowDays = Math.max(1, daysBetween(earliestKey, todayKey) + 1)

  const estimates = input.items.map((item): DemandEstimate => {
    const byDay = unitsBySkuDay.get(item.id) ?? new Map<string, number>()
    const observedUnits = [...byDay.values()].reduce((sum, value) => sum + value, 0)
    const activeDays = [...byDay.values()].filter((value) => value > 0).length

    const dayKeys = [...byDay.keys()].sort()
    const firstDay = dayKeys[0] ?? todayKey
    const observationDays = dayKeys.length ? daysBetween(firstDay, todayKey) + 1 : 0

    // Dense series with explicit zeros: a gap is evidence of low demand.
    const series: number[] = []
    for (let offset = 0; offset < windowDays; offset += 1) {
      const date = new Date(Date.parse(`${earliestKey}T00:00:00Z`) + offset * 86_400_000)
      series.push(byDay.get(date.toISOString().slice(0, 10)) ?? 0)
    }

    const [low, high] = visualRange(item)
    const onHandLow = Math.max(0, low - observedUnits)
    const onHandHigh = Math.max(onHandLow, high - observedUnits)
    const onHandEstimate = Math.round((onHandLow + onHandHigh) / 2)

    const notes: string[] = []
    let quality: DemandQuality = 'sufficient'
    if (!observedUnits) {
      quality = 'none'
      notes.push('No confirmed basket has included this item, so there is no demand signal for it yet.')
    } else if (observedUnits < MIN_UNITS_FOR_RATE || windowDays < MIN_DAYS_OF_HISTORY) {
      quality = 'sparse'
      notes.push(`Only ${observedUnits} unit${observedUnits === 1 ? '' : 's'} over ${windowDays} day${windowDays === 1 ? '' : 's'}. Treat the rate as a hint, not a forecast.`)
    }

    const ratePerDay = quality === 'none' ? null : exponentiallyWeightedRate(series, dailyDecay)
    const meanPerDay = quality === 'none' ? null : observedUnits / windowDays
    const daysOfCover = ratePerDay && ratePerDay > 0
      ? Math.round((onHandEstimate / ratePerDay) * 10) / 10
      : null

    if (item.stockFlag === 'out') notes.push('Marked unavailable in the catalog, so it needs restocking regardless of rate.')
    else if (item.stockFlag === 'low') notes.push('Flagged low in the catalog.')
    if (item.stockLabel === 'Count not read') {
      notes.push('The photo showed a price, not a shelf count, so on-hand is a wide default band.')
    }

    const needsReorder = item.stockFlag === 'out'
      || item.stockFlag === 'low'
      || onHandLow <= 2
      || (daysOfCover !== null && daysOfCover <= COVER_THRESHOLD_DAYS)

    return {
      skuId: item.id,
      itemName: item.name,
      ratePerDay,
      meanPerDay,
      observedUnits,
      observationDays,
      activeDays,
      onHandEstimate,
      onHandLow,
      onHandHigh,
      daysOfCover,
      needsReorder,
      quality,
      notes,
    }
  })

  return {
    estimates,
    inputs: {
      halfLifeDays: HALF_LIFE_DAYS,
      dailyDecay: Math.round(dailyDecay * 1000) / 1000,
      coverThresholdDays: COVER_THRESHOLD_DAYS,
      windowDays,
      attributedBaskets,
      unattributedPayments: Math.min(unattributedPayments, successfulPayments),
    },
  }
}

/** Reorder candidates, soonest stockout first. */
export function reorderQueue(report: DemandReport): DemandEstimate[] {
  return report.estimates
    .filter((estimate) => estimate.needsReorder)
    .sort((a, b) => (a.daysOfCover ?? 9_999) - (b.daysOfCover ?? 9_999))
}
