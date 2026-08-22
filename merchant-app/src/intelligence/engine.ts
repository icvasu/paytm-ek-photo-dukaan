import { dailySalesSeries, deriveDashboard, hourlyActivity, returningShare, successRateByHour } from '../domain/metrics.ts'
import { formatINR } from '../lib/money.ts'
import { weekdayName, parseISO } from '../lib/dates.ts'
import type { BusinessInsight, MerchantStoreData } from '../types/models.ts'

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
    insights.push({
      id: 'insight_catalog_restock',
      merchantId: data.merchant.id,
      kind: 'catalog',
      title: unavailable.length ? `${unavailable[0].name} needs attention` : `${low.length} catalog items may run low`,
      description: `${unavailable.length} unavailable and ${low.length} low-stock items from the photo. ${matchingItems.length} item prices also appear directly in successful payment amounts, so keep those lines visible.`,
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
        : `Collections over the last 7 days are ${Math.abs(dash.weekDeltaPct).toFixed(0)}% lower than the previous 7 days. Tuesdays are typically the weakest days for this store.`,
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
          : `A typical ${weekday} for Meena Kirana is around ${formatINR(Math.round(typicalAvg))}. Today so far: ${formatINR(todayPoint.paise)}.`,
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
      description:
        'Morning grocery runs and the 6–9 pm neighbourhood rush drive most successful payments. Staffing the counter then reduces missed sales.',
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
    description: `${customers.returningPct.toFixed(0)}% of successful tagged payments come from customers who have paid more than once. Fatima Shaikh (daily staples) and Ramesh Iyer (Saturday stock-up) are the clearest examples.`,
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
