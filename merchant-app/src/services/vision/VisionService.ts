import type { CatalogItem, VisionResult } from '../../types/models'

export interface VisionInput {
  fileName: string
  fileSize: number
  imageType: string
}

export interface VisionService {
  analyze(input: VisionInput): Promise<VisionResult>
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
  item('limca', 'Limca 750 ml', 4500, 'out', 'Not visible', 'Drinks'),
  item('biscuit', 'Parle-G Biscuit', 1000, 'in_stock', '15+ packs', 'Snacks'),
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
}

export const demoVisionService: VisionService = new DemoVisionService()
