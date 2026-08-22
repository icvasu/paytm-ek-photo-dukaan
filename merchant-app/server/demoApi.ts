import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { buildSeed } from '../src/data/seed.js'
import { buildInsights } from '../src/intelligence/engine.js'
import { buildDraftTransaction, DemoPaytmService, applyChargeToDraft } from '../src/services/paytm/PaytmService.js'
import { createId } from '../src/lib/ids.js'
import type { CatalogItem, CollectPaymentInput, MerchantStoreData, VisionResult } from '../src/types/models.js'

let db: MerchantStoreData = buildSeed()
const processor = new DemoPaytmService(700)

function json(res: ServerResponse, status: number, value: unknown) {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Access-Control-Allow-Origin', 'http://localhost:5173')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.end(JSON.stringify(value))
}

function addNotification(notification: MerchantStoreData['notifications'][number]) {
  db.notifications.unshift(notification)
}

async function body(req: IncomingMessage) {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(Buffer.from(chunk))
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
}

async function api(req: IncomingMessage, res: ServerResponse) {
  if (req.method === 'OPTIONS') return json(res, 204, null)
  const url = new URL(req.url ?? '/', 'http://localhost')
  const path = url.pathname
  if (req.method === 'GET' && path === '/api/health') return json(res, 200, { ok: true, mode: 'demo', official: false })
  if (req.method === 'GET' && path === '/api/merchant') return json(res, 200, db.merchant)
  if (req.method === 'GET' && path === '/api/transactions') return json(res, 200, db.transactions)
  if (req.method === 'GET' && path.startsWith('/api/transactions/')) {
    const item = db.transactions.find((t) => t.id === path.split('/').pop())
    return json(res, item ? 200 : 404, item ?? { error: 'Transaction not found' })
  }
  if (req.method === 'GET' && path === '/api/customers') return json(res, 200, db.customers)
  if (req.method === 'GET' && path.startsWith('/api/customers/')) {
    const item = db.customers.find((c) => c.id === path.split('/').pop())
    return json(res, item ? 200 : 404, item ?? { error: 'Customer not found' })
  }
  if (req.method === 'GET' && path === '/api/settlements') return json(res, 200, db.settlements)
  if (req.method === 'GET' && path === '/api/notifications') return json(res, 200, db.notifications)
  if (req.method === 'GET' && path === '/api/insights') return json(res, 200, buildInsights(db))
  if (req.method === 'GET' && path === '/api/catalog') return json(res, 200, db.catalog)
  if (req.method === 'GET' && path.startsWith('/api/dukaan/')) {
    const slug = path.split('/').pop()
    return json(res, db.catalog?.slug === slug ? 200 : 404, db.catalog?.slug === slug ? db.catalog : { error: 'Dukaan not found' })
  }
  if (req.method === 'POST' && path === '/api/catalog') {
    const input = await body(req) as VisionResult & { sourceImageName?: string }
    if (!Array.isArray(input.items) || input.items.length === 0) return json(res, 400, { error: 'Catalog needs at least one item' })
    const safeItems = input.items.slice(0, 30).map((item): CatalogItem => ({
      id: String(item.id || createId('item')),
      name: String(item.name || 'New item').slice(0, 80),
      pricePaise: Math.max(0, Math.round(Number(item.pricePaise) || 0)),
      available: item.available !== false,
      stockFlag: item.stockFlag === 'out' || item.stockFlag === 'low' ? item.stockFlag : 'in_stock',
      stockLabel: String(item.stockLabel || 'Check stock').slice(0, 40),
      category: String(item.category || 'General').slice(0, 40),
    }))
    db.catalog = {
      id: 'dukaan_meena',
      merchantId: db.merchant.id,
      title: 'Meena Kirana Digital Dukaan',
      slug: 'meena-kirana',
      items: safeItems,
      sourceImageName: String(input.sourceImageName || 'shop-photo').slice(0, 100),
      sourceKind: input.sourceKind === 'demo' ? 'demo' : 'upload',
      confidence: input.confidence === 'high' || input.confidence === 'medium' ? input.confidence : 'starter',
      readingNote: String(input.readingNote || 'Editable demo catalog').slice(0, 240),
      createdAt: db.demoClock,
      updatedAt: db.demoClock,
    }
    return json(res, 201, db.catalog)
  }
  if (req.method === 'POST' && path === '/api/catalog/items') {
    if (!db.catalog) return json(res, 404, { error: 'Create a catalog first' })
    db.catalog.items.push({
      id: createId('item'), name: 'New item', pricePaise: 1000,
      available: true, stockFlag: 'in_stock', stockLabel: 'Check stock', category: 'General',
    })
    db.catalog.updatedAt = new Date().toISOString()
    return json(res, 201, db.catalog)
  }
  if (req.method === 'POST' && /^\/api\/catalog\/items\/[^/]+$/.test(path)) {
    if (!db.catalog) return json(res, 404, { error: 'Catalog not found' })
    const id = path.split('/')[4]
    const input = await body(req) as Partial<CatalogItem>
    const item = db.catalog.items.find((value) => value.id === id)
    if (!item) return json(res, 404, { error: 'Catalog item not found' })
    if (typeof input.name === 'string' && input.name.trim()) item.name = input.name.trim().slice(0, 80)
    if (Number.isFinite(input.pricePaise) && Number(input.pricePaise) >= 0) item.pricePaise = Math.round(Number(input.pricePaise))
    if (typeof input.available === 'boolean') {
      item.available = input.available
      item.stockFlag = input.available ? (item.stockFlag === 'out' ? 'in_stock' : item.stockFlag) : 'out'
      item.stockLabel = input.available ? (item.stockLabel === 'Not available' ? 'Check stock' : item.stockLabel) : 'Not available'
    }
    db.catalog.updatedAt = new Date().toISOString()
    return json(res, 200, db.catalog)
  }
  if (req.method === 'POST' && /^\/api\/catalog\/items\/[^/]+\/remove$/.test(path)) {
    if (!db.catalog) return json(res, 404, { error: 'Catalog not found' })
    const id = path.split('/')[4]
    db.catalog.items = db.catalog.items.filter((value) => value.id !== id)
    db.catalog.updatedAt = new Date().toISOString()
    return json(res, 200, db.catalog)
  }
  if (req.method === 'POST' && path === '/api/payments') {
    const input = await body(req) as CollectPaymentInput
    if (!Number.isFinite(input.amountRupees) || input.amountRupees <= 0) return json(res, 400, { error: 'Enter a valid amount' })
    const draft = buildDraftTransaction(db.merchant.id, input, db.demoClock, db.transactions.length + 1)
    const result = await processor.charge({
      merchantId: db.merchant.id, amountRupees: input.amountRupees,
      method: input.paymentMethod, vpa: db.merchant.vpa, note: input.note,
    })
    const transaction = applyChargeToDraft(draft, result)
    db.transactions.push(transaction)
    const notification = {
      id: createId('ntf'), merchantId: db.merchant.id,
      type: result.ok ? 'payment_received' as const : 'payment_failed' as const,
      title: result.ok ? 'Payment received' : 'Payment failed',
      body: result.ok ? `${transaction.customerName} paid ₹${input.amountRupees.toLocaleString('en-IN')}` : result.failureReason ?? 'Payment failed',
      read: false, createdAt: transaction.createdAt, relatedEntityId: transaction.id,
      relatedRoute: `/payments/${transaction.id}`, priority: result.ok ? 'normal' as const : 'high' as const,
    }
    addNotification(notification)
    return json(res, 201, { transaction, notification })
  }
  if (req.method === 'POST' && path === '/api/settlements/instant') {
    const open = db.transactions.filter((t) => t.status === 'success' && !t.settlementId)
    const amountPaise = open.reduce((sum, t) => sum + t.amountPaise, 0)
    if (amountPaise < 5000) return json(res, 400, { error: 'Need at least ₹50 available to settle' })
    const result = await processor.settleNow({ merchantId: db.merchant.id, amountPaise, accountLast4: db.merchant.bankAccountLast4 })
    const id = createId('stl')
    const settlement = {
      id, merchantId: db.merchant.id, amountPaise, status: 'completed' as const,
      expectedDate: result.completedAt, completedAt: result.completedAt, bankRef: result.bankRef,
      transactionIds: open.map((t) => t.id), mode: 'instant' as const,
    }
    db.settlements.unshift(settlement)
    db.transactions = db.transactions.map((t) => open.some((o) => o.id === t.id) ? { ...t, settlementId: id, settledAt: result.completedAt } : t)
    const notification = {
      id: createId('ntf'), merchantId: db.merchant.id, type: 'settlement' as const,
      title: 'Instant settlement completed',
      body: `₹${(amountPaise / 100).toLocaleString('en-IN')} sent to ${db.merchant.bankName} ••${db.merchant.bankAccountLast4}`,
      read: false, createdAt: result.completedAt, relatedEntityId: id,
      relatedRoute: '/settlements', priority: 'normal' as const,
    }
    addNotification(notification)
    return json(res, 201, { settlement })
  }
  if (req.method === 'POST' && /^\/api\/transactions\/[^/]+\/refund$/.test(path)) {
    const id = path.split('/')[3]
    const transaction = db.transactions.find((t) => t.id === id)
    if (!transaction || transaction.status !== 'success') return json(res, 400, { error: 'Only a successful payment can be refunded' })
    if (transaction.settlementId) return json(res, 400, { error: 'Already settled. Refund from bank settlement is not enabled in demo.' })
    transaction.status = 'refunded'
    addNotification({
      id: createId('ntf'), merchantId: db.merchant.id, type: 'ops',
      title: 'Refund completed',
      body: `₹${(transaction.amountPaise / 100).toLocaleString('en-IN')} returned to ${transaction.customerName}`,
      read: false, createdAt: new Date().toISOString(), relatedEntityId: transaction.id,
      relatedRoute: `/payments/${transaction.id}`, priority: 'normal',
    })
    return json(res, 200, { transaction })
  }
  if (req.method === 'POST' && /^\/api\/transactions\/[^/]+\/confirm$/.test(path)) {
    const id = path.split('/')[3]
    const input = await body(req) as { success?: boolean }
    const transaction = db.transactions.find((t) => t.id === id)
    if (!transaction || transaction.status !== 'pending') return json(res, 400, { error: 'Only a pending payment can be confirmed' })
    transaction.status = input.success ? 'success' : 'failed'
    transaction.failureReason = input.success ? null : 'Customer did not complete UPI pin'
    addNotification({
      id: createId('ntf'), merchantId: db.merchant.id,
      type: input.success ? 'payment_received' : 'payment_failed',
      title: input.success ? 'Payment confirmed' : 'Payment failed',
      body: input.success
        ? `${transaction.customerName} paid ₹${(transaction.amountPaise / 100).toLocaleString('en-IN')}`
        : transaction.failureReason ?? 'Payment failed',
      read: false, createdAt: transaction.createdAt, relatedEntityId: transaction.id,
      relatedRoute: `/payments/${transaction.id}`, priority: input.success ? 'normal' : 'high',
    })
    return json(res, 200, { transaction })
  }
  if (req.method === 'POST' && path === '/api/notifications/read') {
    const input = await body(req) as { id?: string; all?: boolean }
    db.notifications = db.notifications.map((notification) =>
      input.all || notification.id === input.id ? { ...notification, read: true } : notification,
    )
    return json(res, 200, { notifications: db.notifications })
  }
  if (req.method === 'POST' && path === '/api/reset') {
    db = buildSeed()
    return json(res, 200, { ok: true })
  }
  return json(res, 404, { error: 'Demo API route not found' })
}

export function demoApiPlugin(): Plugin {
  return {
    name: 'paytm-merchant-demo-api',
    configureServer(server) {
      server.middlewares.use('/api', (req, res) => {
        req.url = `/api${req.url ?? ''}`
        void api(req, res).catch((error) => json(res, 500, { error: error instanceof Error ? error.message : 'Demo API error' }))
      })
    },
  }
}
