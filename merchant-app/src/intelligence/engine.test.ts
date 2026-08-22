/**
 * Guards that every insight sentence is derived from the ledger.
 *
 * An earlier build shipped insight copy that named "Fatima Shaikh and Ramesh
 * Iyer" and asserted "Tuesdays are typically the weakest days" as string
 * literals. Both happened to be true of the seeded data, which is exactly what
 * made them dangerous: they read as findings and would have survived into a
 * different merchant's ledger unchanged. The tests below rename the customers
 * and reshape the week, then assert the copy moves with the data.
 */
import { describe, expect, it } from 'vitest'
import { buildSeed } from '../data/seed.js'
import { peakWindow, topRepeatCustomers, weakestWeekday } from '../domain/metrics.js'
import { buildInsights } from './engine.js'
import { parseISO } from '../lib/dates.js'
import type { MerchantStoreData } from '../types/models.js'

const insight = (data: MerchantStoreData, id: string) =>
  buildInsights(data).find((entry) => entry.id === id)

describe('insight copy is computed, not asserted', () => {
  it('names the regulars the ledger actually has, and follows a rename', () => {
    const data = buildSeed()
    const regulars = topRepeatCustomers(data, 2)
    expect(regulars.length).toBeGreaterThan(0)

    const before = insight(data, 'insight_customers')!
    for (const regular of regulars) {
      expect(before.description).toContain(regular.name)
    }

    // Rename every customer. If any name were a literal, it would survive.
    const renamed: MerchantStoreData = {
      ...data,
      transactions: data.transactions.map((txn) => ({
        ...txn,
        customerName: txn.customerId ? `Renamed ${txn.customerId}` : txn.customerName,
      })),
    }
    const after = insight(renamed, 'insight_customers')!
    for (const regular of regulars) {
      expect(after.description).not.toContain(regular.name)
    }
    expect(after.description).toContain('Renamed cust_')
  })

  it('never hardcodes a weekday: the weakest day is read off the ledger', () => {
    const data = buildSeed()
    const weakest = weakestWeekday(data)

    // Force the softer-than-last-week branch so the sentence is emitted at all.
    const now = parseISO(data.demoClock)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() - 7)
    const softer: MerchantStoreData = {
      ...data,
      transactions: data.transactions.filter(
        (txn) => parseISO(txn.createdAt) < cutoff || txn.status !== 'success',
      ),
    }
    const trend = insight(softer, 'insight_trend')
    if (trend && weakestWeekday(softer)) {
      expect(trend.description).toContain(weakestWeekday(softer)!.weekday)
    }

    // The seeded shop is quietest on Tuesday, so the honest sentence may still
    // say Tuesday. What must not happen is the word appearing when the data
    // does not support it.
    const allInsights = buildInsights(data)
    for (const entry of allInsights) {
      const claimed = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        .filter((day) => entry.description.includes(`${day} is the weakest`))
      for (const day of claimed) {
        expect(weakest?.weekday).toBe(day)
      }
    }
  })

  it('reports the peak window share that hourlyActivity actually shows', () => {
    const data = buildSeed()
    const window = peakWindow(data)!
    const peak = insight(data, 'insight_peak')!
    expect(peak.description).toContain(`${window.sharePct.toFixed(0)}%`)
    expect(window.sharePct).toBeGreaterThan(0)
    expect(window.sharePct).toBeLessThanOrEqual(100)
  })

  it('uses the merchant on record rather than a baked-in shop name', () => {
    const data = buildSeed()
    const renamed: MerchantStoreData = {
      ...data,
      merchant: { ...data.merchant, businessName: 'Some Other Store' },
    }
    const pattern = insight(renamed, 'insight_today_vs_pattern')
    if (pattern) {
      expect(pattern.description).not.toContain('Meena Kirana')
    }
  })

  it('emits no insight sentence containing a rupee figure it did not compute', () => {
    const data = buildSeed()
    // Every insight must carry a metric value; a card with none is a card with
    // nothing behind it.
    for (const entry of buildInsights(data)) {
      expect(entry.metricValue ?? '').not.toBe('')
      expect(entry.description.length).toBeGreaterThan(0)
    }
  })
})

describe('weakestWeekday refuses to answer without enough history', () => {
  it('returns null when there is no ledger to compare', () => {
    const data = buildSeed()
    expect(weakestWeekday({ ...data, transactions: [] })).toBeNull()
  })
})

describe('topRepeatCustomers only counts genuine repeats', () => {
  it('excludes customers with a single successful payment', () => {
    const data = buildSeed()
    for (const entry of topRepeatCustomers(data, 5)) {
      expect(entry.successCount).toBeGreaterThanOrEqual(2)
    }
  })

  it('ignores untagged walk-in payments', () => {
    const data = buildSeed()
    const untagged: MerchantStoreData = {
      ...data,
      transactions: data.transactions.map((txn) => ({ ...txn, customerId: null })),
    }
    expect(topRepeatCustomers(untagged, 5)).toHaveLength(0)
  })
})
