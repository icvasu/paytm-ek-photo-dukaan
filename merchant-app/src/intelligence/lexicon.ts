/**
 * Product lexicon for Indian kirana and tea-counter stock.
 *
 * Two jobs, both of which need real reference data rather than a guess:
 *  1. Map noisy OCR text onto a canonical product name and category.
 *  2. Give the parsed price a plausibility band, so "Parle-G at ₹850" is
 *     flagged instead of accepted.
 *
 * Price bands are typical 2024–25 Indian MRP ranges. They are priors used to
 * score confidence — never to overwrite what was actually read off the shelf.
 */

export interface LexiconEntry {
  id: string
  /** Canonical display name. */
  name: string
  /** Spellings, brand names, Hindi/Hinglish forms and common OCR variants. */
  aliases: string[]
  category: string
  /** Plausible price window in paise, inclusive. */
  priceBandPaise: [number, number]
}

function entry(
  id: string,
  name: string,
  category: string,
  bandRupees: [number, number],
  aliases: string[],
): LexiconEntry {
  return {
    id,
    name,
    category,
    priceBandPaise: [bandRupees[0] * 100, bandRupees[1] * 100],
    // The canonical name is always a candidate alias.
    aliases: [name, ...aliases],
  }
}

export const PRODUCT_LEXICON: LexiconEntry[] = [
  // Staples
  entry('tata-salt', 'Tata Salt 1 kg', 'Staples', [20, 40], ['tata salt', 'salt', 'namak', 'tata namak', 'iodised salt']),
  entry('aashirvaad-atta', 'Aashirvaad Atta 5 kg', 'Staples', [200, 400], ['aashirvaad', 'ashirvad atta', 'aashirwad', 'atta', 'wheat flour', 'gehu atta', 'chakki atta']),
  entry('sugar', 'Sugar 1 kg', 'Staples', [40, 70], ['madhur sugar', 'sugar', 'cheeni', 'chini', 'shakkar']),
  entry('rice', 'Rice 1 kg', 'Staples', [45, 150], ['chawal', 'basmati', 'sona masoori', 'rice']),
  entry('maida', 'Maida 1 kg', 'Staples', [40, 70], ['maida', 'refined flour']),
  entry('sooji', 'Sooji 1 kg', 'Staples', [40, 70], ['sooji', 'suji', 'rava', 'semolina']),
  entry('besan', 'Besan 1 kg', 'Staples', [70, 130], ['besan', 'gram flour', 'chana atta']),

  // Pulses
  entry('toor-dal', 'Toor Dal 1 kg', 'Pulses', [110, 220], ['toor dal', 'tur dal', 'arhar dal', 'toordal', 'dal']),
  entry('moong-dal', 'Moong Dal 1 kg', 'Pulses', [110, 200], ['moong dal', 'mung dal', 'green gram']),
  entry('chana-dal', 'Chana Dal 1 kg', 'Pulses', [80, 160], ['chana dal', 'chana', 'bengal gram']),
  entry('urad-dal', 'Urad Dal 1 kg', 'Pulses', [110, 220], ['urad dal', 'urad', 'black gram']),
  entry('masoor-dal', 'Masoor Dal 1 kg', 'Pulses', [80, 160], ['masoor dal', 'masoor', 'red lentil']),
  entry('rajma', 'Rajma 1 kg', 'Pulses', [120, 240], ['rajma', 'kidney beans']),

  // Cooking
  entry('fortune-oil', 'Fortune Sunflower Oil 1 L', 'Cooking', [100, 220], ['fortune oil', 'fortune sunflower', 'sunflower oil', 'refined oil', 'tel', 'cooking oil', 'oil']),
  entry('ghee', 'Ghee 500 ml', 'Cooking', [250, 500], ['ghee', 'desi ghee', 'amul ghee']),
  entry('haldi', 'Turmeric Powder 100 g', 'Cooking', [20, 70], ['haldi', 'turmeric', 'haldi powder']),
  entry('mirch', 'Chilli Powder 100 g', 'Cooking', [25, 90], ['mirch', 'lal mirch', 'chilli powder', 'red chilli']),
  entry('jeera', 'Cumin 100 g', 'Cooking', [30, 120], ['jeera', 'cumin', 'zeera']),
  entry('garam-masala', 'Garam Masala 100 g', 'Cooking', [40, 120], ['garam masala', 'masala', 'everest masala', 'mdh masala']),

  // Dairy
  entry('amul-milk', 'Amul Taaza Milk 500 ml', 'Dairy', [20, 40], ['amul taaza', 'amul milk', 'milk', 'doodh', 'toned milk', 'amul']),
  entry('curd', 'Curd 400 g', 'Dairy', [25, 60], ['curd', 'dahi', 'yoghurt', 'amul dahi']),
  entry('paneer', 'Paneer 200 g', 'Dairy', [70, 130], ['paneer', 'cottage cheese']),
  entry('butter', 'Butter 100 g', 'Dairy', [50, 80], ['butter', 'amul butter', 'makhan']),
  entry('lassi', 'Lassi 200 ml', 'Dairy', [15, 40], ['lassi', 'chaas', 'buttermilk']),

  // Biscuits
  entry('parle-g', 'Parle-G 250 g', 'Biscuits', [10, 50], ['parle g', 'parleg', 'parle', 'parle biscuit', 'glucose biscuit', 'biscuit']),
  entry('good-day', 'Britannia Good Day 200 g', 'Biscuits', [25, 70], ['good day', 'goodday', 'britannia good day', 'cashew biscuit']),
  entry('marie', 'Marie Gold 250 g', 'Biscuits', [25, 60], ['marie', 'marie gold', 'mariegold', 'britannia marie']),
  entry('oreo', 'Oreo 120 g', 'Biscuits', [20, 60], ['oreo', 'oreo biscuit', 'cream biscuit']),
  entry('hide-seek', 'Hide & Seek 120 g', 'Biscuits', [25, 60], ['hide and seek', 'hide seek', 'hideseek', 'choco chip biscuit']),
  entry('rusk', 'Rusk 200 g', 'Biscuits', [25, 60], ['rusk', 'toast', 'suji rusk']),

  // Snacks
  entry('maggi', 'Maggi Masala 70 g', 'Instant food', [10, 30], ['maggi', 'maggie', 'magi', 'noodles', 'masala noodles', 'instant noodles']),
  entry('yippee', 'Yippee Noodles 70 g', 'Instant food', [10, 30], ['yippee', 'yipee', 'sunfeast yippee']),
  entry('kurkure', 'Kurkure 90 g', 'Snacks', [10, 40], ['kurkure', 'kurkure masala']),
  entry('lays', 'Lays 52 g', 'Snacks', [10, 40], ['lays', 'lays chips', 'potato chips', 'chips']),
  entry('namkeen', 'Namkeen 200 g', 'Snacks', [20, 90], ['namkeen', 'mixture', 'bhujia', 'haldiram namkeen', 'sev']),
  entry('samosa', 'Samosa', 'Snacks', [10, 40], ['samosa', 'samosa plate', 'singhara']),
  entry('vada-pav', 'Vada Pav', 'Snacks', [15, 50], ['vada pav', 'vada', 'batata vada']),
  entry('pakoda', 'Pakoda Plate', 'Snacks', [15, 60], ['pakoda', 'pakora', 'bhajji', 'bajji']),
  entry('sandwich', 'Veg Sandwich', 'Snacks', [30, 100], ['veg sandwich', 'sandwich', 'grilled sandwich']),

  // Drinks
  entry('thums-up', 'Thums Up 750 ml', 'Drinks', [30, 60], ['thums up', 'thumsup', 'thums', 'cola']),
  entry('coca-cola', 'Coca-Cola 750 ml', 'Drinks', [30, 60], ['coca cola', 'coke', 'cocacola']),
  entry('sprite', 'Sprite 750 ml', 'Drinks', [30, 60], ['sprite', 'lemon soda']),
  entry('limca', 'Limca 750 ml', 'Drinks', [30, 60], ['limca', 'limka']),
  entry('maaza', 'Maaza 600 ml', 'Drinks', [30, 60], ['maaza', 'maza', 'mango drink', 'frooti', 'slice']),
  entry('mango-juice', 'Mango Juice', 'Drinks', [20, 80], ['mango juice', 'juice', 'fresh juice']),
  entry('water', 'Water Bottle 1 L', 'Drinks', [10, 30], ['water bottle', 'bisleri', 'mineral water', 'pani', 'water']),
  entry('soda', 'Soda 750 ml', 'Drinks', [15, 40], ['soda', 'club soda']),

  // Hot drinks
  entry('chai', 'Masala Chai', 'Hot drinks', [5, 40], ['masala chai', 'chai', 'tea', 'kadak chai', 'cutting chai', 'special chai']),
  entry('coffee', 'Filter Coffee', 'Hot drinks', [10, 60], ['filter coffee', 'coffee', 'kapi', 'kaapi']),
  entry('tea-leaf', 'Tea 250 g', 'Hot drinks', [80, 200], ['tata tea', 'red label', 'tea powder', 'chai patti']),

  // Breakfast
  entry('idli', 'Idli Plate', 'Breakfast', [20, 80], ['idli', 'idly', 'idli plate', 'idli sambar']),
  entry('dosa', 'Dosa', 'Breakfast', [30, 120], ['dosa', 'plain dosa', 'masala dosa']),
  entry('poha', 'Poha Plate', 'Breakfast', [15, 70], ['poha', 'poha plate', 'kanda poha']),
  entry('upma', 'Upma Plate', 'Breakfast', [15, 70], ['upma', 'uppma']),
  entry('paratha', 'Paratha', 'Breakfast', [20, 90], ['paratha', 'parantha', 'aloo paratha']),
  entry('bread', 'Bread 400 g', 'Breakfast', [20, 60], ['bread', 'pav', 'milk bread', 'britannia bread']),

  // Home care
  entry('surf-excel', 'Surf Excel Easy Wash 500 g', 'Home care', [50, 130], ['surf excel', 'surf', 'easy wash', 'detergent', 'washing powder']),
  entry('rin', 'Rin Bar 250 g', 'Home care', [10, 40], ['rin', 'rin bar', 'detergent bar']),
  entry('vim', 'Vim Bar 200 g', 'Home care', [10, 40], ['vim', 'vim bar', 'dishwash']),
  entry('harpic', 'Harpic 500 ml', 'Home care', [80, 200], ['harpic', 'toilet cleaner']),
  entry('phenyl', 'Phenyl 500 ml', 'Home care', [40, 120], ['phenyl', 'floor cleaner', 'lizol']),

  // Personal care
  entry('lifebuoy', 'Lifebuoy Soap 125 g', 'Personal care', [20, 60], ['lifebuoy', 'life buoy', 'soap', 'sabun']),
  entry('lux', 'Lux Soap 100 g', 'Personal care', [20, 60], ['lux', 'lux soap']),
  entry('colgate', 'Colgate 100 g', 'Personal care', [40, 120], ['colgate', 'toothpaste', 'paste', 'dant manjan']),
  entry('shampoo', 'Shampoo Sachet', 'Personal care', [2, 30], ['shampoo', 'clinic plus', 'sunsilk', 'shampoo sachet']),
  entry('hair-oil', 'Hair Oil 100 ml', 'Personal care', [30, 120], ['hair oil', 'parachute', 'coconut oil', 'navratna']),
]

const CATEGORY_FALLBACK = 'General'

/** Categories present in the lexicon, for grouping unmatched rows sensibly. */
export function knownCategories(): string[] {
  return [...new Set(PRODUCT_LEXICON.map((item) => item.category))]
}

export function lexiconAliases(item: LexiconEntry): string[] {
  return item.aliases
}

/**
 * Where a price sits relative to the entry's plausible band.
 * 1 = inside the band, falling off smoothly outside it.
 */
export function priceBandFit(entry: LexiconEntry, pricePaise: number): number {
  const [low, high] = entry.priceBandPaise
  if (pricePaise >= low && pricePaise <= high) return 1
  const distance = pricePaise < low ? low - pricePaise : pricePaise - high
  const width = Math.max(1, high - low)
  // A price one band-width outside scores ~0.37; two widths out, ~0.14.
  return Math.exp(-distance / width)
}

export function describeBand(entry: LexiconEntry): string {
  const [low, high] = entry.priceBandPaise
  return `₹${low / 100}–₹${high / 100}`
}

export { CATEGORY_FALLBACK }
