import {
  dailySalesSeries, deriveDashboard, hourLabel, hourlyActivity, peakWindow, returningShare,
  successRateByHour, topRepeatCustomers, weakestWeekday,
} from '../domain/metrics.js'
import { formatINR } from '../lib/money.js'
import { weekdayName, parseISO } from '../lib/dates.js'
import { estimateDemand, type DemandEstimate, type DemandReport } from './demand.js'
import type { BusinessInsight, MerchantStoreData, StockForecast } from '../types/models.js'

/**
 * Confidence in one forecast, from how much evidence actually backs it.
 *
 * Sparse demand data must not produce a confident-looking number, so the
 * ceiling stays at 85: on-hand is an estimate read off a photo, never a count.
 */
function forecastConfidence(estimate: DemandEstimate, hasSupplier: boolean): number {
  const base = estimate.quality === 'none' ? 30 : estimate.quality === 'sparse' ? 50 : 62
  const evidence = Math.min(20, estimate.observedUnits * 3 + estimate.activeDays * 2)
  // A supplier bill pins down what a full shelf looks like, which tightens the
  // on-hand estimate the days-of-cover figure divides into.
  return Math.min(85, base + evidence + (hasSupplier ? 5 : 0))
}

/** The demand model behind the forecasts, including its inputs for the UI. */
export function buildDemandReport(data: MerchantStoreData): DemandReport {
  return estimateDemand({
    items: data.catalog?.items ?? [],
    assignments: data.basketAssignments ?? [],
    transactions: data.transactions,
    supplier: data.supplier,
    nowIso: data.demoClock,
  })
}

/**
 * Per-item stock forecasts.
 *
 * Velocity is an exponentially weighted units-per-day rate rather than a flat
 * average, so a burst of sales three days ago no longer reads as current
 * demand. See `intelligence/demand.ts` for the model and its stated limits.
 */
export function buildStockForecasts(data: MerchantStoreData): StockForecast[] {
  if (!data.catalog) return []
  const report = buildDemandReport(data)
  const hasSupplier = Boolean(data.supplier)
  return report.estimates.map((estimate): StockForecast => ({
    skuId: estimate.skuId,
    itemName: estimate.itemName,
    estimatedMin: estimate.onHandLow,
    estimatedMax: estimate.onHandHigh,
    soldUnits: estimate.observedUnits,
    dailyVelocity: estimate.ratePerDay ?? 0,
    stockoutDays: estimate.daysOfCover,
    confidencePct: forecastConfidence(estimate, hasSupplier),
    needsReorder: estimate.needsReorder,
  }))
}

export function buildInsights(data: MerchantStoreData): BusinessInsight[] {
  const now = parseISO(data.demoClock)
  const dash = deriveDashboard(data)
  const series = dailySalesSeries(data, 14)
  const last7 = series.slice(-7).reduce((s, d) => s + d.paise, 0)
  const prev7 = series.slice(0, 7).reduce((s, d) => s + d.paise, 0)
  const hours = hourlyActivity(data)
  const peak = [...hours].sort((a, b) => b.count - a.count)[0]
  const rates = successRateByHour(data)
  const afternoon = rates.filter((r) => r.hour >= 13 && r.hour <= 15)
  const rest = rates.filter((r) => r.hour < 13 || r.hour > 15)
  const afternoonFail =
    afternoon.reduce((s, r) => s + r.failed, 0) /
    Math.max(1, afternoon.reduce((s, r) => s + r.failed + r.success, 0))
  const restFail =
    rest.reduce((s, r) => s + r.failed, 0) / Math.max(1, rest.reduce((s, r) => s + r.failed + r.success, 0))
  const customers = returningShare(data)
  // Named from the ledger, never asserted: an insight that hardcodes a weekday
  // or a customer is a sentence pretending to be a finding.
  const weakest = weakestWeekday(data)
  const regulars = topRepeatCustomers(data, 2)
  const window = peakWindow(data)
  const weekday = weekdayName(now)
  const sameWeekday = series.filter((d) => weekdayName(parseISO(d.date)) === weekday)
  const typical = sameWeekday.slice(0, -1)
  const typicalAvg = typical.length ? typical.reduce((s, d) => s + d.paise, 0) / typical.length : 0
  const todayPoint = series[series.length - 1]

  const insights: BusinessInsight[] = []

  if (data.catalog) {
    const unavailable = data.catalog.items.filter((item) => !item.available || item.stockFlag === 'out')
    const low = data.catalog.items.filter((item) => item.available && item.stockFlag === 'low')
    const popularPricePoints = new Set(
      data.transactions
        .filter((transaction) => transaction.status === 'success')
        .map((transaction) => transaction.amountPaise),
    )
    const matchingItems = data.catalog.items.filter((item) => popularPricePoints.has(item.pricePaise))
    const forecasts = buildStockForecasts(data)
    const urgent = forecasts.filter((forecast) => forecast.needsReorder)
      .sort((a, b) => (a.stockoutDays ?? 999) - (b.stockoutDays ?? 999))
    insights.push({
      id: 'insight_catalog_restock',
      merchantId: data.merchant.id,
      kind: 'catalog',
      title: unavailable.length ? `${unavailable[0].name} needs attention` : `${low.length} catalog items may run low`,
      description: `${unavailable.length} unavailable and ${low.length} low-stock items from the photo. ${matchingItems.length} prices appear in successful tickets. ${urgent[0]?.stockoutDays != null ? `${urgent[0].itemName} has about ${urgent[0].stockoutDays} days of cover left at its recent sales rate (${urgent[0].confidencePct}% confidence).` : 'Attach payment baskets to sharpen the forecast.'}`,
      priority: unavailable.length ? 'high' : 'normal',
      metricLabel: 'Dukaan stock hints',
      metricValue: `${unavailable.length + low.length} items`,
      createdAt: data.demoClock,
    })
  }

  if (prev7) {
    const up = last7 >= prev7
    insights.push({
      id: 'insight_trend',
      merchantId: data.merchant.id,
      kind: 'trend',
      title: up ? 'Sales are up versus last week' : 'Sales are softer than last week',
      description: up
        ? `Collections over the last 7 days are ${Math.abs(dash.weekDeltaPct).toFixed(0)}% higher than the previous 7 days. Keep stock ready for evening rush.`
        : `Collections over the last 7 days are ${Math.abs(dash.weekDeltaPct).toFixed(0)}% lower than the previous 7 days.${weakest ? ` ${weakest.weekday} is the weakest day in your last four weeks, averaging ${formatINR(Math.round(weakest.avgPaise / 100) * 100)}.` : ''}`,
      priority: up ? 'normal' : 'high',
      metricLabel: '7-day change',
      metricValue: `${dash.weekDeltaPct >= 0 ? '+' : ''}${dash.weekDeltaPct.toFixed(0)}%`,
      createdAt: data.demoClock,
    })
  }

  if (typicalAvg && todayPoint) {
    const ratio = todayPoint.paise / typicalAvg
    insights.push({
      id: 'insight_today_vs_pattern',
      merchantId: data.merchant.id,
      kind: 'anomaly',
      title:
        ratio < 0.75
          ? `${weekday} collections are behind your usual pattern`
          : `${weekday} is tracking in line with your usual pattern`,
      description:
        ratio < 0.75
          ? `By this point a typical ${weekday} has been closer to ${formatINR(Math.round(typicalAvg))}. Today's successful collections are ${formatINR(todayPoint.paise)}.`
          : `A typical ${weekday} for ${data.merchant.businessName} is around ${formatINR(Math.round(typicalAvg))}. Today so far: ${formatINR(todayPoint.paise)}.`,
      priority: ratio < 0.75 ? 'high' : 'low',
      metricLabel: 'Today vs usual',
      metricValue: `${Math.round(ratio * 100)}%`,
      createdAt: data.demoClock,
    })
  }

  if (peak) {
    const label = peak.hour === 0 ? '12 am' : peak.hour < 12 ? `${peak.hour} am` : peak.hour === 12 ? '12 pm' : `${peak.hour - 12} pm`
    insights.push({
      id: 'insight_peak',
      merchantId: data.merchant.id,
      kind: 'peak_hours',
      title: `Customers are most active around ${label}`,
      description: window
        ? `${window.sharePct.toFixed(0)}% of your successful payments land between ${hourLabel(window.startHour)} and ${hourLabel(window.endHour)}. Staffing the counter through that window reduces missed sales.`
        : `${peak.count} successful payments cluster at this hour. Staffing the counter then reduces missed sales.`,
      priority: 'normal',
      metricLabel: 'Peak hour',
      metricValue: label,
      createdAt: data.demoClock,
    })
  }

  insights.push({
    id: 'insight_success_rate',
    merchantId: data.merchant.id,
    kind: 'success_rate',
    title:
      afternoonFail > restFail * 1.4
        ? 'Payment failures rise between 1 pm and 3 pm'
        : 'Payment success rate is stable through the day',
    description:
      afternoonFail > restFail * 1.4
        ? `Afternoon UPI failures are ${(afternoonFail * 100).toFixed(0)}% versus ${(restFail * 100).toFixed(0)}% at other hours. If a customer is stuck, retrying after a few minutes usually works.`
        : `Overall success rate is ${(dash.successRate * 100).toFixed(0)}%. No unusual failure cluster right now.`,
    priority: afternoonFail > restFail * 1.4 ? 'high' : 'low',
    metricLabel: 'Success rate',
    metricValue: `${(dash.successRate * 100).toFixed(0)}%`,
    createdAt: data.demoClock,
  })

  insights.push({
    id: 'insight_customers',
    merchantId: data.merchant.id,
    kind: 'customers',
    title: 'Regulars still drive most collections',
    description: `${customers.returningPct.toFixed(0)}% of successful tagged payments come from customers who have paid more than once.${regulars.length ? ` Your biggest are ${regulars.map((entry) => `${entry.name} (${entry.successCount} payments, ${formatINR(entry.totalSpendPaise)})`).join(' and ')}.` : ''}`,
    priority: 'normal',
    metricLabel: 'Repeat share',
    metricValue: `${customers.returningPct.toFixed(0)}%`,
    createdAt: data.demoClock,
  })

  if (dash.availablePaise >= 500000) {
    insights.push({
      id: 'insight_settle',
      merchantId: data.merchant.id,
      kind: 'settlement',
      title: 'You can move today’s balance to the bank now',
      description: `${formatINR(dash.availablePaise)} is sitting as available balance from successful payments that have not been settled yet. Instant settlement is useful before a supplier payment.`,
      priority: 'normal',
      metricLabel: 'Available',
      metricValue: formatINR(dash.availablePaise),
      createdAt: data.demoClock,
    })
  }

  return insights
}

export interface IntelligenceEngine {
  generate(data: MerchantStoreData): BusinessInsight[]
}

export const ruleBasedIntelligence: IntelligenceEngine = {
  generate: buildInsights,
}
