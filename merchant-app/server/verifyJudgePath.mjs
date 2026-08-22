/**
 * Walks the judged demo path against a running API and prints a pass/fail line
 * per step, plus the adversarial cases.
 *
 * Usage: node server/verifyJudgePath.mjs [baseUrl]
 *
 * This exercises the same endpoints the UI calls, in the same order, so a
 * regression in the demo loop shows up here before it shows up on stage.
 */
const BASE = (process.argv[2] ?? 'http://127.0.0.1:5173').replace(/\/$/, '')

let passed = 0
let failed = 0
const failures = []

function check(label, ok, detail = '') {
  if (ok) {
    passed += 1
    console.log(`  PASS  ${label}${detail ? ` — ${detail}` : ''}`)
  } else {
    failed += 1
    failures.push(label)
    console.log(`  FAIL  ${label}${detail ? ` — ${detail}` : ''}`)
  }
  return ok
}

async function api(path, init) {
  const response = await fetch(`${BASE}${path}`, init)
  const text = await response.text()
  let body = null
  try { body = text ? JSON.parse(text) : null } catch { body = text }
  return { status: response.status, body }
}

const postJson = (path, payload) => api(path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload ?? {}),
})

function section(title) {
  console.log(`\n${title}`)
}

/** Exact-sum basket search, mirroring the client solver's bounds. */
function solve(amountPaise, items, maxDistinct = 4, maxPerItem = 12) {
  const prices = [...new Set(items.filter((i) => i.available && i.pricePaise > 0).map((i) => i.pricePaise))]
    .sort((a, b) => b - a)
  const picks = []
  let found = null
  const search = (index, remaining) => {
    if (found) return
    if (remaining === 0) { found = [...picks]; return }
    if (index >= prices.length || picks.length >= maxDistinct) return
    const cap = Math.min(maxPerItem, Math.floor(remaining / prices[index]))
    for (let quantity = cap; quantity >= 1; quantity -= 1) {
      picks.push({ pricePaise: prices[index], quantity })
      search(index + 1, remaining - prices[index] * quantity)
      picks.pop()
      if (found) return
    }
    search(index + 1, remaining)
  }
  search(0, amountPaise)
  if (!found) return null
  return found.map((pick) => {
    const item = items.find((candidate) => candidate.pricePaise === pick.pricePaise && candidate.available)
    return { skuId: item.id, itemName: item.name, quantity: pick.quantity, pricePaise: pick.pricePaise }
  })
}

async function main() {
  console.log(`Judge path verification against ${BASE}`)

  section('0. Health')
  const health = await api('/api/health')
  check('health responds 200', health.status === 200, `persistence=${health.body?.persistence}`)
  check('health declares itself unofficial', health.body?.official === false)

  section('1. Reset')
  const reset = await postJson('/api/reset')
  check('reset returns ok', reset.status === 200 && reset.body?.ok === true)
  const afterReset = await api('/api/catalog')
  check('catalog is empty after reset', afterReset.body === null, `got ${JSON.stringify(afterReset.body)?.slice(0, 40)}`)
  const seededTxns = await api('/api/transactions')
  check('payments are seeded after reset', Array.isArray(seededTxns.body) && seededTxns.body.length > 0,
    `${seededTxns.body?.length} payments`)

  section('2-3. Photo to catalog')
  // The judged path uses Meena's kirana shelf: on that catalog ₹45 has exactly
  // one exact basket (1× Thums Up), which is what the demo script narrates.
  const item = (id, name, pricePaise, stockFlag, stockLabel, category) => ({
    id, name, pricePaise, available: stockFlag !== 'out', stockFlag, stockLabel, category, source: 'sample',
  })
  const catalogPayload = {
    items: [
      item('tata-salt', 'Tata Salt 1 kg', 2800, 'in_stock', '12–18 packs', 'Staples'),
      item('aashirvaad', 'Aashirvaad Atta 5 kg', 29500, 'low', '2–4 bags', 'Staples'),
      item('toor-dal', 'Toor Dal 1 kg', 16800, 'in_stock', '8–12 packs', 'Pulses'),
      item('fortune-oil', 'Fortune Sunflower Oil 1 L', 14200, 'low', '3–5 pouches', 'Cooking'),
      item('maggi', 'Maggi Masala 70 g', 1400, 'in_stock', '20+ packs', 'Snacks'),
      item('parle-g', 'Parle-G 250 g', 2500, 'in_stock', '15–20 packs', 'Biscuits'),
      item('good-day', 'Britannia Good Day 200 g', 4000, 'in_stock', '10–14 packs', 'Biscuits'),
      item('thums-up', 'Thums Up 750 ml', 4500, 'low', '2–3 bottles', 'Drinks'),
      item('amul-milk', 'Amul Taaza Milk 500 ml', 2900, 'out', 'Missing today', 'Dairy'),
      item('surf-excel', 'Surf Excel Easy Wash 500 g', 7800, 'in_stock', '6–9 packs', 'Home care'),
      item('sugar', 'Madhur Sugar 1 kg', 5200, 'in_stock', '8–10 packs', 'Staples'),
      item('lifebuoy', 'Lifebuoy Soap 125 g', 3800, 'in_stock', '10–12 bars', 'Personal care'),
    ],
    confidence: 'high',
    readingNote: 'Verification run',
    sourceKind: 'demo',
    sourceImageName: 'meena-kirana-shelf.svg',
    provenance: { method: 'sample_photo', engine: null, linesRead: 0, rowsAccepted: 12, rowsRejected: 0, meanOcrConfidencePct: null, durationMs: null },
  }
  const created = await postJson('/api/catalog', catalogPayload)
  check('catalog created', created.status === 201 && created.body?.items?.length === 12)
  check('catalog has the demo slug', created.body?.slug === 'meena-kirana')

  section('4. Edit an item')
  const edited = await postJson('/api/catalog/items/tata-salt', { pricePaise: 3000 })
  const salt = edited.body?.items?.find((i) => i.id === 'tata-salt')
  check('price edit persists', salt?.pricePaise === 3000, `tata-salt=${salt?.pricePaise}`)
  const reEdited = await postJson('/api/catalog/items/tata-salt', { pricePaise: 2800 })
  check('price edit reverts cleanly', reEdited.body?.items?.find((i) => i.id === 'tata-salt')?.pricePaise === 2800)

  section('5. Public dukaan')
  const publicDukaan = await api('/api/dukaan/meena-kirana')
  check('public dukaan resolves', publicDukaan.status === 200)
  check('public dukaan reports its state', typeof publicDukaan.body?.state === 'string', publicDukaan.body?.state)
  const missing = await api('/api/dukaan/not-a-real-shop')
  check('unknown slug 404s with a known-slug hint', missing.status === 404 && missing.body?.knownSlug === 'meena-kirana')

  section('7. Supplier bill')
  const invoice = {
    name: 'Sharma Traders',
    phone: '+91 98765 44110',
    sourceImageName: 'verify-invoice',
    lines: [
      { skuId: 'thums-up', itemName: 'Thums Up 750 ml', quantity: 24, unitCostPaise: 3600 },
      { skuId: 'amul-milk', itemName: 'Amul Taaza Milk 500 ml', quantity: 30, unitCostPaise: 2450 },
      { skuId: 'fortune-oil', itemName: 'Fortune Sunflower Oil 1 L', quantity: 24, unitCostPaise: 12400 },
    ],
    invoiceTotalPaise: 0,
    normalOrderPaise: 0,
    disclosure: 'Verification run',
  }
  const supplier = await postJson('/api/supplier/invoice', invoice)
  check('supplier saved', supplier.status === 201 && supplier.body?.supplier?.lines?.length === 3)
  check('invoice total recomputed server-side',
    supplier.body?.supplier?.invoiceTotalPaise === 24 * 3600 + 30 * 2450 + 24 * 12400,
    `₹${(supplier.body?.supplier?.invoiceTotalPaise ?? 0) / 100}`)

  section('8. Collect a payment and confirm the basket')
  const catalogItems = created.body.items
  const pay45 = await postJson('/api/payments', { amountRupees: 45, paymentMethod: 'upi', customerName: 'Judge', note: 'Counter payment' })
  check('₹45 recorded', pay45.status === 201, `status=${pay45.body?.transaction?.status}`)
  const txn = pay45.body?.transaction
  if (txn?.status === 'success') {
    const lines = solve(txn.amountPaise, catalogItems)
    check('basket solver found an exact basket for ₹45', Boolean(lines),
      lines?.map((l) => `${l.quantity}× ${l.itemName}`).join(', '))
    if (lines) {
      const attach = await postJson(`/api/transactions/${txn.id}/basket`, { lines })
      check('basket attaches to the payment', attach.status === 200)
      check('payment note now names the items', /Items:/.test(attach.body?.transaction?.note ?? ''),
        attach.body?.transaction?.note)
    }
    const wrong = await postJson(`/api/transactions/${txn.id}/basket`, {
      lines: [{ skuId: 'chai', itemName: 'Masala Chai', quantity: 1, pricePaise: 1000 }],
    })
    check('a basket that does not total the payment is rejected', wrong.status === 400, wrong.body?.error)
  }

  section('9. Restock and approve reorder')
  const order = await postJson('/api/supplier-orders', { skuIds: ['thums-up'] })
  check('order queued', order.status === 201 && order.body?.order?.status === 'queued',
    `₹${(order.body?.order?.amountPaise ?? 0) / 100}`)
  const doubleTap = await postJson('/api/supplier-orders', { skuIds: ['thums-up'] })
  check('double-tapped approve does not queue a second order',
    doubleTap.status === 200 && doubleTap.body?.duplicate === true)

  section('10. Simulate payout and confirm stock moved')
  const orderId = order.body.order.id
  const before = (await api('/api/catalog')).body.items.find((i) => i.id === 'thums-up')
  const confirmed = await postJson(`/api/supplier-orders/${orderId}/confirm`)
  check('order confirmed', confirmed.status === 200 && confirmed.body?.order?.status === 'confirmed')
  const after = (await api('/api/catalog')).body.items.find((i) => i.id === 'thums-up')
  check('stock flag moved off low', before.stockFlag === 'low' && after.stockFlag === 'in_stock',
    `${before.stockFlag} → ${after.stockFlag}`)
  check('stock label reflects the received quantity', after.stockLabel !== before.stockLabel,
    `"${before.stockLabel}" → "${after.stockLabel}"`)
  const confirmAgain = await postJson(`/api/supplier-orders/${orderId}/confirm`)
  check('double-tapped confirm replays instead of failing',
    confirmAgain.status === 200 && confirmAgain.body?.duplicate === true)

  section('Adversarial: odd amounts')
  for (const amount of [1, 73, 211, 9999, 45.5]) {
    const result = await postJson('/api/payments', { amountRupees: amount, paymentMethod: 'upi', customerName: 'Judge' })
    const recorded = result.status === 201
    const solved = recorded && result.body.transaction.status === 'success'
      ? solve(result.body.transaction.amountPaise, catalogItems)
      : null
    check(`₹${amount} handled without error`, recorded,
      recorded ? `${result.body.transaction.status}, basket ${solved ? solved.map((l) => `${l.quantity}×${l.itemName}`).join('+') : 'none — says so honestly'}` : result.body?.error)
  }

  section('Adversarial: rejected input')
  const zero = await postJson('/api/payments', { amountRupees: 0, paymentMethod: 'upi' })
  check('₹0 is refused with a reason', zero.status === 400, zero.body?.error)
  const negative = await postJson('/api/payments', { amountRupees: -5, paymentMethod: 'upi' })
  check('negative amount is refused', negative.status === 400, negative.body?.error)
  const huge = await postJson('/api/payments', { amountRupees: 1e9, paymentMethod: 'upi' })
  check('absurd amount is refused', huge.status === 400, huge.body?.error)
  const subPaise = await postJson('/api/payments', { amountRupees: 10.555, paymentMethod: 'upi' })
  check('sub-paise amount is refused', subPaise.status === 400, subPaise.body?.error)
  const garbage = await api('/api/payments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{not json' })
  check('malformed JSON becomes a 400, not a 500', garbage.status === 400, garbage.body?.code)
  const wrongVerb = await api('/api/catalog/items', { method: 'GET' })
  check('wrong verb becomes a 405 with Allow', wrongVerb.status === 405, wrongVerb.body?.code)
  const noRoute = await api('/api/nope')
  check('unknown route becomes a clear 404', noRoute.status === 404, noRoute.body?.code)

  section('Adversarial: empty catalog')
  await postJson('/api/reset')
  const orderNoSupplier = await postJson('/api/supplier-orders', { skuIds: ['thums-up'] })
  check('reorder without a supplier is refused with a reason', orderNoSupplier.status === 400, orderNoSupplier.body?.error)
  const invoiceNoCatalog = await postJson('/api/supplier/invoice', invoice)
  check('supplier bill without a catalog is refused with a reason', invoiceNoCatalog.status === 400, invoiceNoCatalog.body?.error)
  const emptyCatalog = await postJson('/api/catalog', { items: [] })
  check('empty catalog is refused', emptyCatalog.status === 400, emptyCatalog.body?.error)

  console.log(`\n${failed === 0 ? 'ALL PASS' : 'FAILURES'}: ${passed} passed, ${failed} failed`)
  if (failures.length) {
    console.log('Failed checks:')
    for (const label of failures) console.log(`  - ${label}`)
  }
  process.exit(failed === 0 ? 0 : 1)
}

main().catch((error) => {
  console.error('Verification run could not complete:', error)
  process.exit(2)
})
