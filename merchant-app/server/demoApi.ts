import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Plugin } from 'vite'
import { buildSeed } from '../src/data/seed.js'
import { buildInsights } from '../src/intelligence/engine.js'
import { buildDraftTransaction, DemoPaytmService, applyChargeToDraft } from '../src/services/paytm/PaytmService.js'
import { DEFAULT_DUKAAN_SLUG, buildSeededPublicCatalog } from '../src/services/vision/VisionService.js'
import { createId } from '../src/lib/ids.js'
import type {
  BasketLine, CatalogItem, CatalogItemSource, CatalogMethod, CatalogProvenance,
  CollectPaymentInput, MerchantStoreData, SupplierProfile, VisionResult,
} from '../src/types/models.js'

const ITEM_SOURCES: CatalogItemSource[] = ['sample', 'ocr', 'manual']
const CATALOG_METHODS: CatalogMethod[] = ['sample_photo', 'device_ocr', 'manual_entry']

function clampPct(value: unknown): number | null {
  const numeric = Number(value)
  if (!Number.isFinite(numeric)) return null
  return Math.max(0, Math.min(100, Math.round(numeric)))
}

function sanitizeProvenance(value: unknown): CatalogProvenance | undefined {
  if (!value || typeof value !== 'object') return undefined
  const input = value as Partial<CatalogProvenance>
  const method = CATALOG_METHODS.includes(input.method as CatalogMethod) ? input.method as CatalogMethod : 'manual_entry'
  const count = (raw: unknown) => Math.max(0, Math.min(100000, Math.round(Number(raw) || 0)))
  return {
    method,
    engine: typeof input.engine === 'string' && input.engine ? input.engine.slice(0, 60) : null,
    linesRead: count(input.linesRead),
    rowsAccepted: count(input.rowsAccepted),
    rowsRejected: count(input.rowsRejected),
    meanOcrConfidencePct: clampPct(input.meanOcrConfidencePct),
    durationMs: Number.isFinite(Number(input.durationMs)) ? Math.max(0, Math.round(Number(input.durationMs))) : null,
  }
}

const demoGlobal = globalThis as typeof globalThis & { __paytmEkPhotoDukaanState?: MerchantStoreData }
let db: MerchantStoreData = demoGlobal.__paytmEkPhotoDukaanState ?? buildSeed()
demoGlobal.__paytmEkPhotoDukaanState = db
const processor = new DemoPaytmService(700)
const STORE_KEY = 'paytm-ek-photo-dukaan:demo-state:v1'

function redisConfig() {
  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN
  return url && token ? { url: url.replace(/\/$/, ''), token } : null
}

/** Hard ceiling on a shared-store round trip, so a dead Redis cannot hang a request. */
const STORE_TIMEOUT_MS = 2500

/**
 * What actually happened to the state behind the last request. `/api/health`
 * reports this verbatim: a configured-but-unreachable store degrades to
 * per-instance memory and says so, rather than claiming durability it lost.
 */
type PersistenceMode = 'instance-memory' | 'shared-redis' | 'shared-redis-unreachable-using-memory'

let persistenceMode: PersistenceMode = redisConfig() ? 'shared-redis' : 'instance-memory'
let persistenceError: string | null = null
/** Set once the shared store has answered at least one request in this instance. */
let sharedStoreVerified = false

function noteStoreFailure(reason: unknown) {
  persistenceMode = 'shared-redis-unreachable-using-memory'
  persistenceError = reason instanceof Error ? reason.message.slice(0, 200) : 'Shared demo store request failed'
}

function noteStoreSuccess() {
  sharedStoreVerified = true
  persistenceMode = 'shared-redis'
  persistenceError = null
}

async function redisCommand(command: string[]) {
  const config = redisConfig()
  if (!config) return null
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STORE_TIMEOUT_MS)
  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    })
    const payload = await response.json() as { result?: unknown; error?: string }
    if (!response.ok || payload.error) throw new Error(payload.error ?? `Shared demo store returned ${response.status}`)
    return payload.result
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Best-effort read of the shared state. Never throws: an unreachable store
 * leaves this instance on its own in-memory copy, which still demos correctly,
 * and flips `persistenceMode` so health stops claiming shared durability.
 */
async function loadSharedState() {
  if (!redisConfig()) return
  try {
    const result = await redisCommand(['GET', STORE_KEY])
    noteStoreSuccess()
    if (typeof result !== 'string') return
    db = JSON.parse(result) as MerchantStoreData
    demoGlobal.__paytmEkPhotoDukaanState = db
  } catch (reason) {
    noteStoreFailure(reason)
  }
}

/** Best-effort write. Never throws: the response has usually already been sent. */
async function saveSharedState() {
  if (!redisConfig()) return
  try {
    await redisCommand(['SET', STORE_KEY, JSON.stringify(db)])
    noteStoreSuccess()
  } catch (reason) {
    noteStoreFailure(reason)
  }
}

function seedPublicCatalog() {
  if (db.catalog) return db.catalog
  db.catalog = buildSeededPublicCatalog(db.merchant.id, db.demoClock)
  return db.catalog
}

function corsHeaders(res: ServerResponse) {
  // The public dukaan is opened by scanning a QR on someone else's phone, and
  // may be served from a preview origin. `*` is safe here: no cookies, no auth.
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
  res.setHeader('Access-Control-Max-Age', '86400')
  res.setHeader('Vary', 'Origin')
}

/**
 * Guarantees one error contract — `{ error, code, status }` — for every failure
 * response, including the older call sites that only pass `{ error }`. The UI
 * can then branch on `code` and always has something honest to render.
 */
function normalizeError(status: number, value: unknown) {
  if (status < 400 || !value || typeof value !== 'object' || Array.isArray(value)) return value
  const record = value as Record<string, unknown>
  if (typeof record.error !== 'string') return value
  return { code: 'request_failed', ...record, status }
}

export function json(res: ServerResponse, status: number, value: unknown) {
  if (res.headersSent || res.writableEnded) return
  res.statusCode = status
  corsHeaders(res)
  // 204/304 must not carry a body, and a stale demo response is worse than none.
  res.setHeader('Cache-Control', 'no-store')
  if (status === 204 || status === 304) {
    res.removeHeader('Content-Type')
    res.end()
    return
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  let text: string
  try {
    text = JSON.stringify(normalizeError(status, value) ?? null)
    // JSON.stringify returns undefined for undefined/function values.
    if (typeof text !== 'string') text = 'null'
  } catch {
    res.statusCode = 500
    text = JSON.stringify({ error: 'The demo server built a response it could not serialise.', code: 'response_encoding' })
  }
  res.end(text)
}

/** One error shape for every failure, so the UI never has to guess. */
function fail(res: ServerResponse, status: number, code: string, error: string) {
  return json(res, status, { error, code, status })
}

function addNotification(notification: MerchantStoreData['notifications'][number]) {
  db.notifications.unshift(notification)
}

/** Refuse a body large enough to be an attack or an accident, before parsing it. */
const MAX_BODY_BYTES = 512 * 1024

class BadRequestError extends Error {
  readonly code: string
  constructor(message: string, code: string) {
    super(message)
    this.code = code
  }
}

/**
 * Reads and parses a JSON request body. Throws BadRequestError (mapped to 400)
 * for anything malformed, so a bad client can never produce a 500.
 */
async function body(req: IncomingMessage): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = []
  let bytes = 0
  for await (const chunk of req) {
    const buffer = Buffer.from(chunk)
    bytes += buffer.length
    if (bytes > MAX_BODY_BYTES) {
      throw new BadRequestError('Request body is too large for this demo API.', 'body_too_large')
    }
    chunks.push(buffer)
  }
  const text = Buffer.concat(chunks).toString('utf8').trim()
  if (!text) return {}
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new BadRequestError('Request body is not valid JSON.', 'invalid_json')
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BadRequestError('Request body must be a JSON object.', 'invalid_body_shape')
  }
  return parsed as Record<string, unknown>
}

/** Largest rupee amount the demo will accept. Also blocks Infinity and 1e308. */
const MAX_AMOUNT_RUPEES = 100_000

/** Below this the amount rounds to zero paise, so it is not a payment. */
const MIN_AMOUNT_RUPEES = 1

/**
 * Monotonic source for the printed order reference.
 *
 * `processor.charge` awaits, so several rapid taps all reach this point before
 * any of them appends to the ledger. Deriving the sequence from the current
 * length would hand every request in that burst the same reference, and the
 * payment list is searched by reference. Reserving the number synchronously
 * keeps them distinct.
 */
let referenceSequence = 0

function nextReferenceSequence(currentCount: number): number {
  referenceSequence = Math.max(referenceSequence + 1, currentCount + 1)
  return referenceSequence
}

async function routeDemoApi(req: IncomingMessage, res: ServerResponse) {
  // Base is only needed to parse a relative request URL; it is never sent anywhere.
  const url = new URL(req.url ?? '/', 'http://demo.invalid')
  const path = url.pathname
  if (req.method === 'OPTIONS') {
    const allowed = allowedMethodsFor(path)
    if (allowed) res.setHeader('Allow', allowed.join(', '))
    return json(res, 204, null)
  }
  if (req.method === 'HEAD') {
    // Uptime checkers and link previewers send HEAD; answer without a body.
    return json(res, allowedMethodsFor(path)?.includes('GET') ? 204 : 404, null)
  }
  if (req.method === 'GET' && path === '/api/health') {
    const configured = Boolean(redisConfig())
    return json(res, 200, {
      ok: true,
      mode: 'demo',
      official: false,
      // Truthful, not optimistic: "shared-redis" is only claimed after the
      // store has actually answered this instance at least once.
      persistence: configured
        ? (sharedStoreVerified && persistenceMode === 'shared-redis' ? 'shared-redis' : persistenceMode)
        : 'instance-memory',
      sharedStore: {
        configured,
        verified: sharedStoreVerified,
        lastError: persistenceError,
      },
      publicDukaanFallback: 'seeded-sample',
      note: configured
        ? 'Shared store configured. `persistence` reports whether it actually answered this instance.'
        : 'No shared store configured. State lives in this serverless instance only and resets on cold start.',
      time: new Date().toISOString(),
    })
  }
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
  if (req.method === 'GET' && /^\/api\/dukaan\/[^/]+\/?$/.test(path)) {
    const slug = decodeURIComponent(path.replace(/\/$/, '').split('/').pop() ?? '')
    // The QR printed for the demo points at DEFAULT_DUKAAN_SLUG. That slug must
    // resolve on a cold instance that has never seen a merchant save, so it is
    // seeded on demand rather than 404ing at the customer's phone.
    const catalog = slug === DEFAULT_DUKAAN_SLUG ? seedPublicCatalog() : db.catalog
    if (!catalog || catalog.slug !== slug) {
      return json(res, 404, {
        error: `No dukaan is published at “${slug.slice(0, 60) || '(empty)'}”.`,
        code: 'dukaan_not_found',
        status: 404,
        knownSlug: DEFAULT_DUKAAN_SLUG,
      })
    }
    return json(res, 200, {
      ...catalog,
      // Lets the storefront say which it is instead of implying a live shop.
      state: catalog.sourceKind === 'demo' && catalog.provenance?.method === 'sample_photo'
        ? 'seeded-sample'
        : 'merchant-published',
      persistence: persistenceMode,
    })
  }
  if (req.method === 'POST' && path === '/api/catalog') {
    const input = await body(req) as unknown as VisionResult & { sourceImageName?: string }
    if (!Array.isArray(input.items) || input.items.length === 0) return json(res, 400, { error: 'Catalog needs at least one item' })
    const usedIds = new Set<string>()
    const safeItems = input.items.slice(0, 40).map((item): CatalogItem => {
      let id = String(item.id || '').slice(0, 60) || createId('item')
      while (usedIds.has(id)) id = createId('item')
      usedIds.add(id)
      const confidencePct = clampPct(item.confidencePct)
      return {
        id,
        name: String(item.name || 'New item').replace(/\s+/g, ' ').trim().slice(0, 80) || 'New item',
        pricePaise: Math.max(0, Math.min(100_000_00, Math.round(Number(item.pricePaise) || 0))),
        available: item.available !== false,
        stockFlag: item.stockFlag === 'out' || item.stockFlag === 'low' ? item.stockFlag : 'in_stock',
        stockLabel: String(item.stockLabel || 'Check stock').slice(0, 40),
        category: String(item.category || 'General').slice(0, 40),
        source: ITEM_SOURCES.includes(item.source as CatalogItemSource) ? item.source : 'manual',
        ...(confidencePct === null ? {} : { confidencePct }),
      }
    })
    db.catalog = {
      id: 'dukaan_meena',
      merchantId: db.merchant.id,
      title: 'Meena Kirana Digital Dukaan',
      slug: 'meena-kirana',
      items: safeItems,
      sourceImageName: String(input.sourceImageName || 'shop-photo').slice(0, 100),
      sourceKind: input.sourceKind === 'demo' ? 'demo' : 'upload',
      confidence: input.confidence === 'high' || input.confidence === 'medium' ? input.confidence : 'starter',
      readingNote: String(input.readingNote || 'Editable catalog').slice(0, 400),
      createdAt: db.demoClock,
      updatedAt: db.demoClock,
      provenance: sanitizeProvenance(input.provenance),
    }
    return json(res, 201, db.catalog)
  }
  if (req.method === 'POST' && path === '/api/catalog/items') {
    if (!db.catalog) return json(res, 404, { error: 'Create a catalog first' })
    if (db.catalog.items.length >= 60) return json(res, 400, { error: 'This demo catalog holds 60 items at most' })
    const input = await body(req) as { name?: unknown; pricePaise?: unknown }
    const name = String(input.name ?? '').replace(/\s+/g, ' ').trim().slice(0, 80)
    const rawPrice = Number(input.pricePaise)
    if (input.name !== undefined && !name) return json(res, 400, { error: 'Item name cannot be empty' })
    if (input.pricePaise !== undefined && (!Number.isFinite(rawPrice) || rawPrice < 0)) {
      return json(res, 400, { error: 'Enter a price of ₹0 or more' })
    }
    db.catalog.items.push({
      id: createId('item'),
      name: name || 'New item',
      pricePaise: Number.isFinite(rawPrice) && rawPrice >= 0 ? Math.min(100_000_00, Math.round(rawPrice)) : 1000,
      available: true,
      stockFlag: 'in_stock',
      stockLabel: 'Check stock',
      category: 'General',
      source: 'manual',
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
      disclosure: String(input.disclosure || 'Merchant-confirmed supplier bill. No payable, bank instruction or supplier API call was created.').slice(0, 300),
    }
    addNotification({
      id: createId('ntf'), merchantId: db.merchant.id, type: 'ops',
      title: 'Supplier bill saved',
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
    // Clamped before the total check: these strings end up in the payment note,
    // and an OCR-read name can be far longer than a real product name.
    const lines = (input.lines ?? []).slice(0, 40).filter((line) => Number(line.quantity) > 0).map((line) => ({
      skuId: String(line.skuId ?? '').slice(0, 80),
      itemName: String(line.itemName ?? '').replace(/\s+/g, ' ').trim().slice(0, 80) || 'Item',
      quantity: Math.max(1, Math.min(999, Math.round(Number(line.quantity)))),
      pricePaise: Math.max(0, Math.min(100_000_00, Math.round(Number(line.pricePaise) || 0))),
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
    if (!db.supplier) return fail(res, 400, 'no_supplier', 'Scan a supplier invoice first')
    const input = await body(req) as { skuIds?: unknown }
    if (input.skuIds !== undefined && !Array.isArray(input.skuIds)) {
      return fail(res, 400, 'invalid_sku_ids', 'skuIds must be an array of catalog ids.')
    }
    const requested = Array.isArray(input.skuIds)
      ? input.skuIds.filter((value): value is string => typeof value === 'string').slice(0, 100)
      : []
    const selected = new Set(requested)
    const lines = db.supplier.lines.filter((line) => !selected.size || selected.has(line.skuId))
    if (!lines.length) return fail(res, 400, 'empty_order', 'Choose at least one supplier line')
    // Idempotency: a double-tapped "Approve reorder" must not queue two payouts.
    // An identical still-queued order is returned as-is instead of duplicated.
    const fingerprint = lines.map((line) => line.skuId).sort().join('|')
    const existing = db.supplierOrders.find((candidate) =>
      candidate.status === 'queued'
      && candidate.supplierId === db.supplier?.id
      && candidate.lines.map((line) => line.skuId).sort().join('|') === fingerprint)
    if (existing) {
      return json(res, 200, { order: existing, notifications: db.notifications, duplicate: true })
    }
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
    const id = decodeURIComponent(path.split('/')[3] ?? '')
    const order = db.supplierOrders.find((candidate) => candidate.id === id)
    if (!order) return fail(res, 404, 'order_not_found', 'That supplier order does not exist.')
    // Idempotency: confirming an already-confirmed order replays the same
    // result rather than erroring, so a double tap cannot show a false failure.
    if (order.status === 'confirmed') {
      return json(res, 200, { order, catalog: db.catalog, notifications: db.notifications, duplicate: true })
    }
    if (order.status !== 'queued') {
      return fail(res, 409, 'order_not_queued', `This order is ${order.status} and can no longer be confirmed.`)
    }
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
    if (Number.isFinite(Number(input.pricePaise)) && Number(input.pricePaise) >= 0) {
      item.pricePaise = Math.min(100_000_00, Math.round(Number(input.pricePaise)))
    }
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
    const input = await body(req) as unknown as CollectPaymentInput
    const amountRupees = Number(input.amountRupees)
    if (!Number.isFinite(amountRupees) || amountRupees <= 0) {
      return fail(res, 400, 'invalid_amount', 'Enter a valid amount')
    }
    // Below one rupee the amount rounds to zero paise, which would put a ₹0.00
    // row in the ledger. Reject it instead of recording a payment of nothing.
    if (amountRupees < MIN_AMOUNT_RUPEES) {
      return fail(res, 400, 'amount_too_small', `The smallest payment this demo records is ₹${MIN_AMOUNT_RUPEES}.`)
    }
    if (Math.round(amountRupees * 100) !== Number((amountRupees * 100).toFixed(4))) {
      return fail(res, 400, 'invalid_amount', 'An amount can have at most two decimal places.')
    }
    if (amountRupees > MAX_AMOUNT_RUPEES) {
      return fail(res, 400, 'amount_too_large', `This demo collects at most ₹${MAX_AMOUNT_RUPEES.toLocaleString('en-IN')} in one payment.`)
    }
    // Guard the rest of the pipeline against a string or a 1e308 slipping through.
    input.amountRupees = amountRupees
    const draft = buildDraftTransaction(db.merchant.id, input, db.demoClock, nextReferenceSequence(db.transactions.length))
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
      // No bank is contacted anywhere in this prototype, so the notification
      // must not read as money having landed in an account.
      title: 'Settlement recorded (simulated)',
      body: `₹${(amountPaise / 100).toLocaleString('en-IN')} marked settled against ${db.merchant.bankName} ••${db.merchant.bankAccountLast4}. Prototype ledger only — no bank instruction was created.`,
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
    demoGlobal.__paytmEkPhotoDukaanState = db
    return json(res, 200, { ok: true })
  }
  // The path exists but the verb is wrong: say so with 405 + Allow, rather than
  // a misleading 404 that sends someone hunting for a missing route.
  const allowed = allowedMethodsFor(path)
  if (allowed) {
    res.setHeader('Allow', allowed.join(', '))
    return fail(res, 405, 'method_not_allowed', `${req.method ?? 'This method'} is not supported here. Use ${allowed.join(' or ')}.`)
  }
  return fail(res, 404, 'route_not_found', `No demo API route matches ${path.slice(0, 120)}.`)
}

/** Known paths and their verbs, used only to turn a wrong verb into a 405. */
const ROUTE_METHODS: [RegExp, string[]][] = [
  [/^\/api\/health$/, ['GET']],
  [/^\/api\/(merchant|transactions|customers|settlements|notifications|insights|supplier|supplier-orders|basket-assignments)$/, ['GET']],
  [/^\/api\/catalog$/, ['GET', 'POST']],
  [/^\/api\/(transactions|customers)\/[^/]+$/, ['GET']],
  [/^\/api\/dukaan\/[^/]+\/?$/, ['GET']],
  [/^\/api\/catalog\/items$/, ['POST']],
  [/^\/api\/catalog\/items\/[^/]+(\/remove)?$/, ['POST']],
  [/^\/api\/supplier\/invoice$/, ['POST']],
  [/^\/api\/supplier-orders\/[^/]+\/confirm$/, ['POST']],
  [/^\/api\/transactions\/[^/]+\/(basket|refund|confirm)$/, ['POST']],
  [/^\/api\/payments$/, ['POST']],
  [/^\/api\/settlements\/instant$/, ['POST']],
  [/^\/api\/notifications\/read$/, ['POST']],
  [/^\/api\/reset$/, ['POST']],
]

function allowedMethodsFor(path: string): string[] | null {
  for (const [pattern, methods] of ROUTE_METHODS) {
    if (pattern.test(path)) return [...methods, 'OPTIONS']
  }
  return null
}

/**
 * Single entry point for both the Vite dev middleware and the Vercel function.
 *
 * Nothing below is allowed to throw: a bad request becomes a 400, an unexpected
 * fault becomes one 500 with the same JSON shape as every other error, and a
 * failed shared-store write never takes down a request that already succeeded.
 */
export async function handleDemoApi(req: IncomingMessage, res: ServerResponse) {
  const path = new URL(req.url ?? '/', 'http://demo.invalid').pathname
  try {
    await loadSharedState()
    await routeDemoApi(req, res)
  } catch (error) {
    if (error instanceof BadRequestError) {
      fail(res, 400, error.code, error.message)
    } else {
      // Log for the Vercel function log; the client gets a stable, honest shape.
      console.error('[demo-api]', req.method, path, error)
      fail(res, 500, 'server_error', 'The demo server hit an unexpected error. Nothing was saved for this request.')
    }
  }
  try {
    if (req.method !== 'GET' || path.startsWith('/api/dukaan/')) await saveSharedState()
  } catch {
    // saveSharedState already swallows and records; this is belt and braces.
  }
}

/** Mounts the demo API on a Vite middleware stack (dev server or preview). */
function mountDemoApi(middlewares: { use: (path: string, handler: (req: IncomingMessage, res: ServerResponse) => void) => unknown }) {
  middlewares.use('/api', (req, res) => {
    req.url = `/api${req.url ?? ''}`
    void handleDemoApi(req, res).catch((error: unknown) => {
      console.error('[demo-api-plugin]', error)
      json(res, 500, {
        error: 'The demo API failed to handle this request.',
        code: 'handler_crash',
        status: 500,
      })
    })
  })
}

export function demoApiPlugin(): Plugin {
  return {
    name: 'paytm-merchant-demo-api',
    configureServer(server) {
      mountDemoApi(server.middlewares)
    },
    // `vite preview` serves the real production bundle. Without this the built
    // app loads and then every request fails, which looks like a broken demo
    // rather than a server that was never started.
    configurePreviewServer(server) {
      mountDemoApi(server.middlewares)
    },
  }
}
