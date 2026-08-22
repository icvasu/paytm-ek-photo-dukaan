import { isSameDay, parseISO, startOfDay, weekdayName } from '../lib/dates.js'
import type { MerchantStoreData, Transaction } from '../types/models.js'

export function successfulSales(txns: Transaction[]): Transaction[] {
  return txns.filter((t) => t.status === 'success')
}

export function deriveDashboard(data: MerchantStoreData) {
  const now = parseISO(data.demoClock)
  const today = data.transactions.filter((t) => isSameDay(parseISO(t.createdAt), now))
  const successToday = today.filter((t) => t.status === 'success')
  const failedToday = today.filter((t) => t.status === 'failed')
  const pendingToday = today.filter((t) => t.status === 'pending')
  const salesToday = successToday.reduce((s, t) => s + t.amountPaise, 0)

  const available = data.transactions
    .filter((t) => t.status === 'success' && !t.settlementId)
    .reduce((s, t) => s + t.amountPaise, 0)

  const todaysSettlement = data.settlements.find(
    (s) => s.status === 'completed' && isSameDay(parseISO(s.completedAt ?? s.expectedDate), now),
  )
  const upcoming = data.settlements.filter((s) => s.status === 'scheduled' || s.status === 'processing')

  const last7Start = startOfDay(now)
  last7Start.setDate(last7Start.getDate() - 6)
  const last7 = data.transactions.filter((t) => parseISO(t.createdAt) >= last7Start)
  const last7Success = successfulSales(last7)
  const last7Sales = last7Success.reduce((s, t) => s + t.amountPaise, 0)

  const prev7Start = new Date(last7Start)
  prev7Start.setDate(prev7Start.getDate() - 7)
  const prev7 = data.transactions.filter((t) => {
    const d = parseISO(t.createdAt)
    return d >= prev7Start && d < last7Start
  })
  const prev7Sales = successfulSales(prev7).reduce((s, t) => s + t.amountPaise, 0)

  const allSuccess = successfulSales(data.transactions)
  const decided = data.transactions.filter((t) => t.status === 'success' || t.status === 'failed')
  const successRate = decided.length ? allSuccess.length / decided.length : 1

  return {
    salesToday,
    txnToday: today.length,
    successToday: successToday.length,
    failedToday: failedToday.length,
    pendingToday: pendingToday.length,
    availablePaise: available,
    todaySettlementPaise: todaysSettlement?.amountPaise ?? 0,
    upcomingPaise: upcoming.reduce((s, x) => s + x.amountPaise, 0),
    last7Sales,
    prev7Sales,
    weekDeltaPct: prev7Sales ? ((last7Sales - prev7Sales) / prev7Sales) * 100 : 0,
    successRate,
    recent: [...data.transactions].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 8),
  }
}

export function customerStats(data: MerchantStoreData, customerId: string) {
  const txns = data.transactions.filter((t) => t.customerId === customerId)
  const success = successfulSales(txns)
  const last = [...txns].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return {
    transactionCount: txns.length,
    successCount: success.length,
    totalSpendPaise: success.reduce((s, t) => s + t.amountPaise, 0),
    lastTransactionAt: last?.createdAt ?? null,
    lastStatus: last?.status ?? null,
  }
}

export function dailySalesSeries(data: MerchantStoreData, days = 14) {
  const now = parseISO(data.demoClock)
  const series: { date: string; label: string; paise: number; count: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const d = startOfDay(now)
    d.setDate(d.getDate() - i)
    const dayTxns = successfulSales(data.transactions).filter((t) => isSameDay(parseISO(t.createdAt), d))
    series.push({
      date: d.toISOString(),
      label: `${d.getDate()} ${d.toLocaleDateString('en-IN', { month: 'short' })}`,
      paise: dayTxns.reduce((s, t) => s + t.amountPaise, 0),
      count: dayTxns.length,
    })
  }
  return series
}

export function hourlyActivity(data: MerchantStoreData) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, count: 0, paise: 0 }))
  for (const t of successfulSales(data.transactions)) {
    const h = parseISO(t.createdAt).getHours()
    buckets[h].count += 1
    buckets[h].paise += t.amountPaise
  }
  return buckets
}

export function successRateByHour(data: MerchantStoreData) {
  const buckets = Array.from({ length: 24 }, (_, hour) => ({ hour, success: 0, failed: 0 }))
  for (const t of data.transactions) {
    const h = parseISO(t.createdAt).getHours()
    if (t.status === 'success') buckets[h].success += 1
    if (t.status === 'failed') buckets[h].failed += 1
  }
  return buckets.map((b) => ({
    ...b,
    rate: b.success + b.failed ? b.success / (b.success + b.failed) : 1,
  }))
}

export function returningShare(data: MerchantStoreData) {
  const success = successfulSales(data.transactions).filter((t) => t.customerId)
  const counts = new Map<string, number>()
  for (const t of success) counts.set(t.customerId!, (counts.get(t.customerId!) ?? 0) + 1)
  let returning = 0
  let first = 0
  for (const t of success) {
    if ((counts.get(t.customerId!) ?? 0) >= 2) returning += 1
    else first += 1
  }
  const total = returning + first
  return { returning, first, total, returningPct: total ? (returning / total) * 100 : 0 }
}

export function averageTicket(data: MerchantStoreData) {
  const success = successfulSales(data.transactions)
  if (!success.length) return 0
  return Math.round(success.reduce((s, t) => s + t.amountPaise, 0) / success.length)
}

export function weekdayLabel(data: MerchantStoreData) {
  return weekdayName(parseISO(data.demoClock))
}

/**
 * Mean successful collections per weekday over the recent window.
 *
 * Exists so an insight can name the shop's weakest day from the ledger instead
 * of asserting one. Today is excluded: it is still in progress, so counting it
 * would drag its own weekday down every single time.
 */
export function weekdayPerformance(data: MerchantStoreData, days = 28) {
  const now = parseISO(data.demoClock)
  const series = dailySalesSeries(data, days).filter((day) => !isSameDay(parseISO(day.date), now))
  const buckets = new Map<string, { weekday: string; totalPaise: number; days: number }>()
  for (const day of series) {
    const weekday = weekdayName(parseISO(day.date))
    const bucket = buckets.get(weekday) ?? { weekday, totalPaise: 0, days: 0 }
    bucket.totalPaise += day.paise
    bucket.days += 1
    buckets.set(weekday, bucket)
  }
  return [...buckets.values()]
    .map((bucket) => ({ ...bucket, avgPaise: Math.round(bucket.totalPaise / bucket.days) }))
    .sort((a, b) => a.avgPaise - b.avgPaise)
}

/**
 * The weakest weekday by average collections, or null when there is not enough
 * history to make the comparison meaningful.
 */
export function weakestWeekday(data: MerchantStoreData, days = 28) {
  const ranked = weekdayPerformance(data, days)
  // Needs at least two weekdays with a full week each, otherwise "weakest" is
  // an artefact of the window rather than a pattern.
  if (ranked.length < 3 || ranked.every((entry) => entry.days < 2)) return null
  const weakest = ranked[0]
  const busiest = ranked[ranked.length - 1]
  if (!busiest.avgPaise || weakest.avgPaise >= busiest.avgPaise) return null
  return weakest
}

/**
 * Customers with more than one successful payment, ranked by what they actually
 * spent. Used to name regulars from the ledger rather than from a constant.
 */
export function topRepeatCustomers(data: MerchantStoreData, limit = 2) {
  const byCustomer = new Map<string, { customerId: string; name: string; successCount: number; totalSpendPaise: number }>()
  for (const txn of successfulSales(data.transactions)) {
    if (!txn.customerId) continue
    const entry = byCustomer.get(txn.customerId)
      ?? { customerId: txn.customerId, name: txn.customerName, successCount: 0, totalSpendPaise: 0 }
    entry.successCount += 1
    entry.totalSpendPaise += txn.amountPaise
    byCustomer.set(txn.customerId, entry)
  }
  return [...byCustomer.values()]
    .filter((entry) => entry.successCount >= 2)
    .sort((a, b) => b.totalSpendPaise - a.totalSpendPaise)
    .slice(0, limit)
}

/**
 * The busiest contiguous three-hour window of successful payments, and the
 * share of the day's payments inside it.
 */
export function peakWindow(data: MerchantStoreData) {
  const hours = hourlyActivity(data)
  const total = hours.reduce((sum, bucket) => sum + bucket.count, 0)
  if (!total) return null
  let bestStart = 0
  let bestCount = -1
  for (let start = 0; start <= 21; start += 1) {
    const count = hours[start].count + hours[start + 1].count + hours[start + 2].count
    if (count > bestCount) { bestCount = count; bestStart = start }
  }
  return {
    startHour: bestStart,
    endHour: bestStart + 3,
    count: bestCount,
    sharePct: (bestCount / total) * 100,
  }
}

/** "6 pm" style label for an hour of the day. */
export function hourLabel(hour: number): string {
  if (hour === 0 || hour === 24) return '12 am'
  if (hour === 12) return '12 pm'
  return hour < 12 ? `${hour} am` : `${hour - 12} pm`
}
