import type { CatalogItem, SupplierInvoiceLine, SupplierProfile, VisionResult } from '../../types/models.ts'

export const MEENA_SHELF_ITEMS: CatalogItem[] = [
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
]

const TEA_COUNTER_ITEMS: CatalogItem[] = [
  item('chai', 'Masala Chai', 1000, 'in_stock', 'Ready', 'Hot drinks'),
  item('samosa', 'Samosa', 1500, 'in_stock', '12–18 left', 'Snacks'),
  item('water', 'Water Bottle 1 L', 2000, 'in_stock', '10+ bottles', 'Drinks'),
  item('thums-up', 'Thums Up 750 ml', 4500, 'low', '2–3 bottles', 'Drinks'),
  item('limca', 'Limca 750 ml', 4000, 'out', 'Not visible', 'Drinks'),
  item('biscuit', 'Parle-G Biscuit', 1000, 'in_stock', '15+ packs', 'Snacks'),
  item('coffee', 'Filter Coffee', 2500, 'in_stock', 'Ready', 'Hot drinks'),
  item('poha', 'Poha Plate', 3000, 'in_stock', '8–12 plates', 'Breakfast'),
  item('idli', 'Idli Plate', 3500, 'in_stock', '6–10 plates', 'Breakfast'),
  item('juice', 'Mango Juice', 5000, 'low', '3–5 bottles', 'Drinks'),
  item('sandwich', 'Veg Sandwich', 6000, 'in_stock', '5–8 plates', 'Snacks'),
  item('combo', 'Chai + Samosa Combo', 2200, 'in_stock', 'Ready', 'Combos'),
]

function item(
  id: string,
  name: string,
  pricePaise: number,
  stockFlag: CatalogItem['stockFlag'],
  stockLabel: string,
  category: string,
): CatalogItem {
  return {
    id,
    name,
    pricePaise,
    available: stockFlag !== 'out',
    stockFlag,
    stockLabel,
    category,
    source: 'sample',
  }
}

export type SampleShopId = 'meena-kirana-shelf' | 'tea-counter-rate-card'

export interface SampleShop {
  id: SampleShopId
  label: string
  caption: string
  imagePath: string
  fileName: string
  items: CatalogItem[]
  supplier: SampleSupplier
}

interface SampleSupplier {
  name: string
  phone: string
  lines: SupplierInvoiceLine[]
}

/**
 * Pre-written sample shops for a fast, repeatable demo run.
 *
 * These are fixtures, not a vision result: the item list is written by us and
 * tied to the sample image, and every screen that uses one says so. Photos the
 * user supplies go through real on-device OCR instead.
 */
export const SAMPLE_SHOPS: SampleShop[] = [
  {
    id: 'meena-kirana-shelf',
    label: 'Meena’s kirana shelf',
    caption: '12 pre-written items',
    imagePath: '/demo/meena-kirana-shelf.svg',
    fileName: 'meena-kirana-shelf.svg',
    items: MEENA_SHELF_ITEMS,
    supplier: {
      name: 'Sri Balaji Distributors',
      phone: '+91 98765 44110',
      lines: [
        { skuId: 'aashirvaad', itemName: 'Aashirvaad Atta 5 kg', quantity: 10, unitCostPaise: 26000 },
        { skuId: 'fortune-oil', itemName: 'Fortune Sunflower Oil 1 L', quantity: 24, unitCostPaise: 12400 },
        { skuId: 'thums-up', itemName: 'Thums Up 750 ml', quantity: 24, unitCostPaise: 3600 },
        { skuId: 'amul-milk', itemName: 'Amul Taaza Milk 500 ml', quantity: 30, unitCostPaise: 2450 },
      ],
    },
  },
  {
    id: 'tea-counter-rate-card',
    label: 'Printed rate card',
    caption: '12 pre-written items',
    imagePath: '/demo/tea-counter-rate-card.svg',
    fileName: 'tea-counter-rate-card.svg',
    items: TEA_COUNTER_ITEMS,
    supplier: {
      name: 'Sharma Traders',
      phone: '+91 98765 44110',
      lines: [
        { skuId: 'thums-up', itemName: 'Thums Up 750 ml', quantity: 24, unitCostPaise: 3600 },
        { skuId: 'limca', itemName: 'Limca 750 ml', quantity: 24, unitCostPaise: 3200 },
        { skuId: 'juice', itemName: 'Mango Juice', quantity: 12, unitCostPaise: 3900 },
        { skuId: 'biscuit', itemName: 'Parle-G Biscuit', quantity: 48, unitCostPaise: 750 },
      ],
    },
  },
]

function copyItems(items: CatalogItem[]) {
  return items.map((value) => ({ ...value }))
}

export function findSampleShop(id: string): SampleShop | undefined {
  return SAMPLE_SHOPS.find((shop) => shop.id === id)
}

/**
 * Loads a sample shop fixture. Labelled `sample_photo` so the manage screen can
 * say the rows were pre-written rather than read from the picture.
 */
export function loadSampleCatalog(shop: SampleShop): VisionResult & { sourceImageName: string } {
  return {
    items: copyItems(shop.items),
    confidence: 'high',
    readingNote: `Sample shop: these ${shop.items.length} rows ship with the prototype and are tied to the sample picture. They were not read out of it. Edit anything before sharing.`,
    sourceKind: 'demo',
    sourceImageName: shop.fileName,
    provenance: {
      method: 'sample_photo',
      engine: null,
      linesRead: 0,
      rowsAccepted: shop.items.length,
      rowsRejected: 0,
      meanOcrConfidencePct: null,
      durationMs: null,
    },
  }
}

/** Sample supplier bill for the matching sample shop. */
export function loadSampleInvoice(shop: SampleShop): Omit<SupplierProfile, 'id' | 'lastStockInAt'> {
  const lines = shop.supplier.lines.map((line) => ({ ...line }))
  const invoiceTotalPaise = lines.reduce((sum, line) => sum + line.quantity * line.unitCostPaise, 0)
  return {
    name: shop.supplier.name,
    phone: shop.supplier.phone,
    sourceImageName: `${shop.id}-sample-invoice`,
    lines,
    invoiceTotalPaise,
    normalOrderPaise: invoiceTotalPaise,
    disclosure: 'Sample supplier bill that ships with the prototype. Nothing was read from a picture and no payable exists.',
  }
}

/** Picks the sample shop whose fixture matches the catalog currently loaded. */
export function sampleShopForCatalog(items: { id: string }[] | undefined): SampleShop {
  const ids = new Set((items ?? []).map((entry) => entry.id))
  const teaMatches = TEA_COUNTER_ITEMS.filter((entry) => ids.has(entry.id)).length
  const kiranaMatches = MEENA_SHELF_ITEMS.filter((entry) => ids.has(entry.id)).length
  return teaMatches > kiranaMatches ? SAMPLE_SHOPS[1] : SAMPLE_SHOPS[0]
}
