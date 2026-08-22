import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { buildSeed } from '../src/data/seed.js'
import { buildInsights } from '../src/intelligence/engine.js'
import { buildDraftTransaction, DemoPaytmService, applyChargeToDraft } from '../src/services/paytm/PaytmService.js'
import { createId } from '../src/lib/ids.js'
import type {
  BasketLine, CatalogItem, CollectPaymentInput, MerchantStoreData, SupplierProfile, VisionResult,
} from '../src/types/models.js'

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
  if (req.method === 'GET' && path === '/api/supplier') return json(res, 200, db.supplier)
  if (req.method === 'GET' && path === '/api/supplier-orders') return json(res, 200, db.supplierOrders)
  if (req.method === 'GET' && path === '/api/basket-assignments') return json(res, 200, db.basketAssignments)
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
  if (req.method === 'POST' && path === '/api/supplier/invoice') {
    const input = await body(req) as Omit<SupplierProfile, 'id' | 'lastStockInAt'>
    if (!db.catalog) return json(res, 400, { error: 'Create the shop catalog before reading its supplier invoice' })
    if (!Array.isArray(input.lines) || !input.lines.length) return json(res, 400, { error: 'Invoice needs at least one line' })
    const lines = input.lines.slice(0, 30).map((line) => ({
      skuId: String(line.skuId).slice(0, 80),
      itemName: String(line.itemName).slice(0, 80),
      quantity: Math.max(1, Math.min(999, Math.round(Number(line.quantity) || 1))),
      unitCostPaise: Math.max(0, Math.round(Number(line.unitCostPaise) || 0)),
    }))
    const invoiceTotalPaise = lines.reduce((sum, line) => sum + line.quantity * line.unitCostPaise, 0)
    db.supplier = {
      id: 'supplier_primary',
      name: String(input.name || 'Demo Supplier').slice(0, 80),
      phone: String(input.phone || '').slice(0, 24),
      sourceImageName: String(input.sourceImageName || 'supplier-invoice').slice(0, 100),
      lines,
      invoiceTotalPaise,
      normalOrderPaise: invoiceTotalPaise,
      lastStockInAt: new Date().toISOString(),
      disclosure: 'DEMO invoice heuristic. No production OCR or payable was created.',
    }
    addNotification({
      id: createId('ntf'), merchantId: db.merchant.id, type: 'ops',
      title: 'Supplier invoice added (DEMO)',
      body: `${db.supplier.name}: ${lines.length} lines, ₹${(invoiceTotalPaise / 100).toLocaleString('en-IN')} stock-in`,
      read: false, createdAt: db.supplier.lastStockInAt, relatedEntityId: db.supplier.id,
      relatedRoute: '/dukaan/manage', priority: 'normal',
    })
    return json(res, 201, { supplier: db.supplier, catalog: db.catalog })
  }
  if (req.method === 'POST' && /^\/api\/transactions\/[^/]+\/basket$/.test(path)) {
    if (!db.catalog) return json(res, 400, { error: 'Create a catalog first' })
    const transactionId = path.split('/')[3]
    const transaction = db.transactions.find((candidate) => candidate.id === transactionId && candidate.status === 'success')
    if (!transaction) return json(res, 404, { error: 'Successful payment not found' })
    const input = await body(req) as { lines?: BasketLine[] }
    const lines = (input.lines ?? []).filter((line) => line.quantity > 0).map((line) => ({
      skuId: String(line.skuId),
      itemName: String(line.itemName),
      quantity: Math.max(1, Math.round(line.quantity)),
      pricePaise: Math.max(0, Math.round(line.pricePaise)),
    }))
    const total = lines.reduce((sum, line) => sum + line.quantity * line.pricePaise, 0)
    if (!lines.length || total !== transaction.amountPaise) {
      return json(res, 400, { error: `Basket must total ₹${(transaction.amountPaise / 100).toLocaleString('en-IN')}` })
    }
    db.basketAssignments = db.basketAssignments.filter((assignment) => assignment.transactionId !== transactionId)
    db.basketAssignments.push({ transactionId, lines, assignedAt: new Date().toISOString(), source: 'merchant' })
    transaction.note = `Items: ${lines.map((line) => `${line.quantity}× ${line.itemName}`).join(', ')}`
    return json(res, 200, { assignment: db.basketAssignments.at(-1), transaction })
  }
  if (req.method === 'POST' && path === '/api/supplier-orders') {
    if (!db.supplier) return json(res, 400, { error: 'Scan a supplier invoice first' })
    const input = await body(req) as { skuIds?: string[] }
    const selected = new Set(input.skuIds ?? [])
    const lines = db.supplier.lines.filter((line) => !selected.size || selected.has(line.skuId))
    if (!lines.length) return json(res, 400, { error: 'Choose at least one supplier line' })
    const order = {
      id: createId('order'), supplierId: db.supplier.id, status: 'queued' as const, lines,
      amountPaise: lines.reduce((sum, line) => sum + line.quantity * line.unitCostPaise, 0),
      createdAt: new Date().toISOString(), confirmedAt: null,
      note: 'Merchant approved. Simulated Paytm vendor payout queued; no bank API called.',
    }
    db.supplierOrders.unshift(order)
    addNotification({
      id: createId('ntf'), merchantId: db.merchant.id, type: 'business_alert',
      title: 'Supplier order queued (DEMO)',
      body: `${db.supplier.name} · ₹${(order.amountPaise / 100).toLocaleString('en-IN')} · simulated payout only`,
      read: false, createdAt: order.createdAt, relatedEntityId: order.id,
      relatedRoute: '/dukaan/manage', priority: 'high',
    })
    return json(res, 201, { order, notifications: db.notifications })
  }
  if (req.method === 'POST' && /^\/api\/supplier-orders\/[^/]+\/confirm$/.test(path)) {
    const id = path.split('/')[3]
    const order = db.supplierOrders.find((candidate) => candidate.id === id)
    if (!order || order.status !== 'queued') return json(res, 400, { error: 'Queued supplier order not found' })
    order.status = 'confirmed'
    order.confirmedAt = new Date().toISOString()
    if (db.catalog) {
      for (const line of order.lines) {
        const item = db.catalog.items.find((candidate) => candidate.id === line.skuId)
        if (item) {
          item.available = true
          item.stockFlag = 'in_stock'
          item.stockLabel = `${Math.max(1, line.quantity - 3)}–${line.quantity} received`
        }
      }
      db.catalog.updatedAt = order.confirmedAt
    }
    addNotification({
      id: createId('ntf'), merchantId: db.merchant.id, type: 'ops',
      title: 'Stock-in confirmed (DEMO)',
      body: `${order.lines.length} supplier lines received. Catalog ranges updated.`,
      read: false, createdAt: order.confirmedAt, relatedEntityId: order.id,
      relatedRoute: '/dukaan/manage', priority: 'normal',
    })
    return json(res, 200, { order, catalog: db.catalog, notifications: db.notifications })
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
