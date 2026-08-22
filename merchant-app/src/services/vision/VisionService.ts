import type { CatalogItem, SupplierProfile, VisionResult } from '../../types/models'

export interface VisionInput {
  fileName: string
  fileSize: number
  imageType: string
}

export interface VisionService {
  analyze(input: VisionInput): Promise<VisionResult>
  analyzeInvoice(input: VisionInput): Promise<Omit<SupplierProfile, 'id' | 'lastStockInAt'>>
}

const meenaShelf: CatalogItem[] = [
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
]

const counterList: CatalogItem[] = [
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
  return { id, name, pricePaise, available: stockFlag !== 'out', stockFlag, stockLabel, category }
}

function copyItems(items: CatalogItem[]) {
  return items.map((value) => ({ ...value }))
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export class DemoVisionService implements VisionService {
  async analyze(input: VisionInput): Promise<VisionResult> {
    await delay(350)
    const key = input.fileName.toLowerCase()
    if (key.includes('counter') || key.includes('rate') || key.includes('tea')) {
      return {
        items: copyItems(counterList),
        confidence: 'high',
        readingNote: 'Demo mapping recognised a printed counter list. Prices are seeded, not production OCR.',
        sourceKind: 'demo',
      }
    }
    if (key.includes('meena') || key.includes('shelf') || key.includes('kirana')) {
      return {
        items: copyItems(meenaShelf),
        confidence: 'high',
        readingNote: 'Demo mapping recognised the Meena Kirana shelf. Stock is a visual range, not an exact count.',
        sourceKind: 'demo',
      }
    }
    const looksLikeImage = input.imageType.startsWith('image/')
    return {
      items: copyItems(meenaShelf.slice(0, input.fileSize > 1_000_000 ? 10 : 7)),
      confidence: 'starter',
      readingNote: looksLikeImage
        ? 'Prices could not be reliably read in demo mode. We created an editable starter list from visual shelf cues.'
        : 'This file could not be read as an image. An editable starter list was created instead.',
      sourceKind: 'upload',
    }
  }

  async analyzeInvoice(input: VisionInput): Promise<Omit<SupplierProfile, 'id' | 'lastStockInAt'>> {
    await delay(350)
    const key = input.fileName.toLowerCase()
    const teaInvoice = (key.includes('tea') || key.includes('counter')) && !key.includes('meena') && !key.includes('kirana') && !key.includes('shelf')
    const lines = teaInvoice
      ? [
          { skuId: 'thums-up', itemName: 'Thums Up 750 ml', quantity: 24, unitCostPaise: 3600 },
          { skuId: 'limca', itemName: 'Limca 750 ml', quantity: 24, unitCostPaise: 3200 },
          { skuId: 'juice', itemName: 'Mango Juice', quantity: 12, unitCostPaise: 3900 },
          { skuId: 'biscuit', itemName: 'Parle-G Biscuit', quantity: 48, unitCostPaise: 750 },
        ]
      : [
          { skuId: 'aashirvaad', itemName: 'Aashirvaad Atta 5 kg', quantity: 10, unitCostPaise: 26000 },
          { skuId: 'fortune-oil', itemName: 'Fortune Sunflower Oil 1 L', quantity: 24, unitCostPaise: 12400 },
          { skuId: 'thums-up', itemName: 'Thums Up 750 ml', quantity: 24, unitCostPaise: 3600 },
          { skuId: 'amul-milk', itemName: 'Amul Taaza Milk 500 ml', quantity: 30, unitCostPaise: 2450 },
        ]
    const invoiceTotalPaise = lines.reduce((sum, line) => sum + line.quantity * line.unitCostPaise, 0)
    return {
      name: teaInvoice ? 'Sharma Traders' : 'Sri Balaji Distributors',
      phone: '+91 98765 44110',
      sourceImageName: input.fileName,
      lines,
      invoiceTotalPaise,
      normalOrderPaise: invoiceTotalPaise,
      disclosure: 'DEMO invoice heuristic: filename mapping, not production OCR. Merchant approval is required.',
    }
  }
}

export const demoVisionService: VisionService = new DemoVisionService()
