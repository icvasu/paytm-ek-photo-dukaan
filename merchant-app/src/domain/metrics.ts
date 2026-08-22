import { isSameDay, parseISO, startOfDay, weekdayName } from '../lib/dates.ts'
import type { MerchantStoreData, Transaction } from '../types/models.ts'

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
