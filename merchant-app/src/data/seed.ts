import { DEMO_NOW_ISO, addDays, parseISO, startOfDay, toISO } from '../lib/dates.js'
import { rupeesToPaise } from '../lib/money.js'
import type {
  AppNotification,
  Customer,
  Merchant,
  MerchantStoreData,
  PaymentMethod,
  Settlement,
  Transaction,
  TransactionStatus,
} from '../types/models.js'

function mulberry32(seed: number) {
  return function rand() {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const MERCHANT_ID = 'mcht_meena_kirana'

export const merchant: Merchant = {
  id: MERCHANT_ID,
  businessName: 'Meena Kirana & General Store',
  ownerName: 'Meena Reddy',
  category: 'Kirana / Grocery',
  phone: '+91 98490 11234',
  email: 'meena.kirana.demo@example.com',
  address: '14-6-221, Near Ameerpet Metro, Main Road',
  city: 'Hyderabad',
  state: 'Telangana',
  pincode: '500016',
  gstin: '36AAPCM9281D1Z8',
  mid: 'PTM928100012345',
  vpa: 'meenakirana@paytm',
  bankName: 'HDFC Bank',
  bankAccountLast4: '4471',
  ifscMasked: 'HDFC0004XXX',
  soundboxEnabled: true,
  createdAt: '2023-11-04T10:00:00+05:30',
}

export const customers: Customer[] = [
  { id: 'cust_ramesh', name: 'Ramesh Iyer', phone: '+91 98765 43001', segment: 'regular', notes: 'Weekly bulk grocery' },
  { id: 'cust_fatima', name: 'Fatima Shaikh', phone: '+91 98765 43002', segment: 'regular', notes: 'Daily milk, bread, eggs' },
  { id: 'cust_arjun', name: 'Arjun Rao', phone: '+91 98765 43003', segment: 'regular', notes: 'Evening snacks' },
  { id: 'cust_priya', name: 'Priya Nair', phone: '+91 98765 43004', segment: 'regular' },
  { id: 'cust_suresh', name: 'Suresh Kumar', phone: '+91 98765 43005', segment: 'occasional' },
  { id: 'cust_ananya', name: 'Ananya Reddy', phone: '+91 98765 43006', segment: 'regular' },
  { id: 'cust_irfan', name: 'Mohammed Irfan', phone: '+91 98765 43007', segment: 'occasional' },
  { id: 'cust_kavya', name: 'Kavya Sharma', phone: '+91 98765 43008', segment: 'regular' },
  { id: 'cust_vikram', name: 'Vikram Singh', phone: '+91 98765 43009', segment: 'occasional' },
  { id: 'cust_lakshmi', name: 'Lakshmi Devi', phone: '+91 98765 43010', segment: 'regular' },
  { id: 'cust_rohan', name: 'Rohan Patel', phone: '+91 98765 43011', segment: 'new' },
  { id: 'cust_neha', name: 'Neha Gupta', phone: '+91 98765 43012', segment: 'occasional' },
  { id: 'cust_ajay', name: 'Ajay Verma', phone: '+91 98765 43013', segment: 'occasional' },
  { id: 'cust_sana', name: 'Sana Khan', phone: '+91 98765 43014', segment: 'regular' },
  { id: 'cust_deepak', name: 'Deepak Joshi', phone: '+91 98765 43015', segment: 'new' },
  { id: 'cust_pooja', name: 'Pooja Iyer', phone: '+91 98765 43016', segment: 'occasional' },
  { id: 'cust_karthik', name: 'Karthik Menon', phone: '+91 98765 43017', segment: 'regular' },
  { id: 'cust_meera', name: 'Meera Shah', phone: '+91 98765 43018', segment: 'new' },
  { id: 'cust_walkin', name: 'Walk-in customer', phone: '', segment: 'occasional' },
]

const METHODS: PaymentMethod[] = ['upi', 'upi', 'upi', 'upi', 'paytm_wallet', 'card', 'netbanking']
const TICKETS = [42, 68, 85, 110, 145, 180, 220, 260, 310, 385, 460, 540, 720, 890, 1240, 1680, 2100]

function pick<T>(rand: () => number, arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

function hourForSlot(rand: () => number, weekday: number): number {
  const r = rand()
  if (weekday === 0) {
    if (r < 0.45) return 8 + Math.floor(rand() * 3)
    if (r < 0.75) return 17 + Math.floor(rand() * 3)
    return 11 + Math.floor(rand() * 5)
  }
  if (r < 0.32) return 7 + Math.floor(rand() * 3)
  if (r < 0.48) return 11 + Math.floor(rand() * 3)
  if (r < 0.82) return 17 + Math.floor(rand() * 4)
  return 21 + Math.floor(rand() * 2)
}

export function buildSeed(): MerchantStoreData {
  const now = parseISO(DEMO_NOW_ISO)
  const rand = mulberry32(92810001)
  const transactions: Transaction[] = []
  let seq = 1000

  const regulars = customers.filter((c) => c.segment === 'regular' && c.id !== 'cust_walkin')
  const others = customers.filter((c) => c.id !== 'cust_walkin' && c.segment !== 'regular')

  for (let dayOffset = 21; dayOffset >= 0; dayOffset--) {
    const day = addDays(startOfDay(now), -dayOffset)
    const weekday = day.getDay()
    const isTuesday = weekday === 2
    const isWeekend = weekday === 0 || weekday === 6
    let count = isTuesday ? 6 : isWeekend ? 11 : 9
    if (dayOffset === 0) count = 8
    count += Math.floor(rand() * 3)

    if (dayOffset !== 0 || now.getHours() >= 8) {
      const fatimaHour = 8
      const fatimaMin = 12 + Math.floor(rand() * 20)
      pushTxn({
        day,
        hour: fatimaHour,
        minute: fatimaMin,
        customer: customers.find((c) => c.id === 'cust_fatima')!,
        amount: 95 + Math.floor(rand() * 40),
        method: 'upi',
        forceStatus: dayOffset === 3 ? 'failed' : 'success',
        note: 'Milk, bread, eggs',
      })
    }

    if (weekday === 6 && dayOffset > 0) {
      pushTxn({
        day,
        hour: 10,
        minute: 20,
        customer: customers.find((c) => c.id === 'cust_ramesh')!,
        amount: 1860 + Math.floor(rand() * 400),
        method: 'upi',
        forceStatus: 'success',
        note: 'Weekly household stock',
      })
    }

    for (let i = 0; i < count; i++) {
      const hour = hourForSlot(rand, weekday)
      if (dayOffset === 0 && hour > now.getHours()) continue
      const minute = Math.floor(rand() * 60)
      const second = Math.floor(rand() * 60)
      const isWalkin = rand() < 0.18
      const customer = isWalkin
        ? null
        : rand() < 0.55
          ? pick(rand, regulars)
          : pick(rand, others)
      let amount = pick(rand, TICKETS) + Math.floor(rand() * 30)
      if (customer?.id === 'cust_arjun') amount = 60 + Math.floor(rand() * 90)
      const method = pick(rand, METHODS)
      const inDipWindow = hour >= 13 && hour <= 15
      let status: TransactionStatus = 'success'
      const failChance = inDipWindow ? 0.22 : 0.07
      if (rand() < failChance) status = 'failed'
      if (dayOffset === 0 && i === 0) status = 'pending'
      pushTxn({
        day,
        hour,
        minute,
        second,
        customer,
        amount,
        method,
        forceStatus: status,
        note: null,
      })
    }
  }

  const pendingTime = new Date(now)
  pendingTime.setMinutes(pendingTime.getMinutes() - 18)
  pushTxn({
    day: pendingTime,
    hour: pendingTime.getHours(),
    minute: pendingTime.getMinutes(),
    second: 0,
    customer: customers.find((customer) => customer.id === 'cust_priya')!,
    amount: 320,
    method: 'upi',
    forceStatus: 'pending',
    note: 'Counter payment awaiting confirmation',
  })

  function pushTxn(args: {
    day: Date
    hour: number
    minute: number
    second?: number
    customer: Customer | null
    amount: number
    method: PaymentMethod
    forceStatus: TransactionStatus
    note: string | null
  }) {
    const created = new Date(args.day)
    created.setHours(args.hour, args.minute, args.second ?? 10, 0)
    if (created.getTime() > now.getTime()) return
    seq += 1
    const id = `txn_${seq}`
    const failed = args.forceStatus === 'failed'
    transactions.push({
      id,
      merchantId: MERCHANT_ID,
      customerId: args.customer?.id ?? null,
      customerName: args.customer?.name ?? 'Walk-in customer',
      customerPhone: args.customer?.phone ?? null,
      amountPaise: rupeesToPaise(args.amount),
      status: args.forceStatus,
      paymentMethod: args.method,
      createdAt: toISO(created),
      settledAt: null,
      settlementId: null,
      referenceId: `${created.getFullYear()}${String(created.getMonth() + 1).padStart(2, '0')}${String(created.getDate()).padStart(2, '0')}${String(seq).padStart(6, '0')}`,
      upiTxnId: args.method === 'upi' && !failed ? `EPD-${seq}${created.getDate()}${created.getHours()}` : null,
      note: args.note,
      failureReason: failed
        ? pick(rand, [
            'UPI request declined by customer bank',
            'Insufficient balance',
            'Request timed out',
            'Customer cancelled payment',
          ])
        : null,
    })
  }

  transactions.sort((a, b) => a.createdAt.localeCompare(b.createdAt))

  const settlements: Settlement[] = []
  const todayStart = startOfDay(now)

  const byDay = new Map<string, Transaction[]>()
  for (const txn of transactions) {
    if (txn.status !== 'success') continue
    const key = startOfDay(parseISO(txn.createdAt)).toDateString()
    const list = byDay.get(key) ?? []
    list.push(txn)
    byDay.set(key, list)
  }

  let settleSeq = 200
  for (const [dayKey, txns] of byDay) {
    const day = new Date(dayKey)
    if (day.getTime() >= todayStart.getTime()) continue
    const expected = addDays(day, 1)
    expected.setHours(7, 15, 0, 0)
    const completed = expected.getTime() <= now.getTime()
    settleSeq += 1
    const id = `stl_${settleSeq}`
    const amountPaise = txns.reduce((s, t) => s + t.amountPaise, 0)
    const settlement: Settlement = {
      id,
      merchantId: MERCHANT_ID,
      amountPaise,
      status: completed ? 'completed' : 'scheduled',
      expectedDate: toISO(expected),
      completedAt: completed ? toISO(expected) : null,
      bankRef: completed ? `HDFCN${settleSeq}4471` : null,
      transactionIds: txns.map((t) => t.id),
      mode: 't_plus_1',
    }
    settlements.push(settlement)
    for (const t of txns) {
      t.settlementId = id
      t.settledAt = settlement.completedAt
    }
  }

  const notifications: AppNotification[] = []
  const latest = [...transactions].reverse().slice(0, 8)
  for (const txn of latest) {
    if (txn.status === 'success') {
      notifications.push({
        id: `ntf_${txn.id}_ok`,
        merchantId: MERCHANT_ID,
        type: 'payment_received',
        title: 'Payment received',
        body: `${txn.customerName} paid ₹${(txn.amountPaise / 100).toLocaleString('en-IN')} via ${labelMethod(txn.paymentMethod)}`,
        read: parseISO(txn.createdAt).getTime() < now.getTime() - 1000 * 60 * 90,
        createdAt: txn.createdAt,
        relatedEntityId: txn.id,
        relatedRoute: `/payments/${txn.id}`,
        priority: 'normal',
      })
    } else if (txn.status === 'failed') {
      notifications.push({
        id: `ntf_${txn.id}_fail`,
        merchantId: MERCHANT_ID,
        type: 'payment_failed',
        title: 'Payment failed',
        body: `${txn.customerName} · ${txn.failureReason}`,
        read: false,
        createdAt: txn.createdAt,
        relatedEntityId: txn.id,
        relatedRoute: `/payments/${txn.id}`,
        priority: 'high',
      })
    } else if (txn.status === 'pending') {
      notifications.push({
        id: `ntf_${txn.id}_pend`,
        merchantId: MERCHANT_ID,
        type: 'ops',
        title: 'Payment processing',
        body: `Waiting for confirmation of ₹${(txn.amountPaise / 100).toLocaleString('en-IN')}`,
        read: false,
        createdAt: txn.createdAt,
        relatedEntityId: txn.id,
        relatedRoute: `/payments/${txn.id}`,
        priority: 'normal',
      })
    }
  }

  const lastCompleted = [...settlements].reverse().find((s) => s.status === 'completed')
  if (lastCompleted?.completedAt) {
    notifications.push({
      id: `ntf_${lastCompleted.id}`,
      merchantId: MERCHANT_ID,
      type: 'settlement',
      title: 'Settlement credited',
      body: `₹${(lastCompleted.amountPaise / 100).toLocaleString('en-IN')} transferred to HDFC Bank ••4471`,
      read: true,
      createdAt: lastCompleted.completedAt,
      relatedEntityId: lastCompleted.id,
      relatedRoute: '/settlements',
      priority: 'normal',
    })
  }

  notifications.push({
    id: 'ntf_insight_afternoon',
    merchantId: MERCHANT_ID,
    type: 'insight',
    title: 'UPI failures clustered after lunch',
    body: 'Failures between 1–3 pm are higher than the rest of the day. Worth watching if customers complain.',
    read: false,
    createdAt: toISO(addDays(now, 0)),
    relatedEntityId: 'insight_success_rate',
    relatedRoute: '/insights',
    priority: 'high',
  })

  notifications.sort((a, b) => b.createdAt.localeCompare(a.createdAt))

  return {
    merchant,
    customers: customers.filter((c) => c.id !== 'cust_walkin'),
    transactions,
    settlements: settlements.sort((a, b) => b.expectedDate.localeCompare(a.expectedDate)),
    notifications,
    preferences: {
      paymentAlerts: true,
      settlementAlerts: true,
      insightAlerts: true,
    },
    demoClock: DEMO_NOW_ISO,
    catalog: null,
    supplier: null,
    basketAssignments: [],
    supplierOrders: [],
  }
}

function labelMethod(method: PaymentMethod): string {
  if (method === 'upi') return 'UPI'
  if (method === 'paytm_wallet') return 'Paytm Wallet'
  if (method === 'card') return 'Card'
  return 'Net banking'
}

export const SEED_VERSION = 3
