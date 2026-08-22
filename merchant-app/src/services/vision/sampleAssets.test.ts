import { describe, expect, it } from 'vitest'
import { SAMPLE_PHOTOS, SAMPLE_SHOPS } from './VisionService.js'

/**
 * Guards the curated demo photos.
 *
 * These shipped once with bytes that were not valid XML, so every browser drew
 * the sample shelf as a blank image — on the first screen of the demo. They also
 * showed a price that disagreed with the catalog the same button loads. Both
 * faults are invisible in a passing build, hence these checks.
 *
 * Loaded through Vite's raw glob rather than `node:fs` so the suite stays inside
 * the app's TypeScript project, which has no Node types.
 */
const sources = import.meta.glob('/public/demo/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

function svgFor(imagePath: string): string {
  const key = `/public${imagePath}`
  const svg = sources[key]
  if (!svg) throw new Error(`${key} was not found. Known: ${Object.keys(sources).join(', ')}`)
  return svg
}

const shops = SAMPLE_SHOPS.map((shop) => [shop.id, shop] as const)

describe('sample shop images', () => {
  it('every sample shop has an image on disk', () => {
    for (const shop of SAMPLE_SHOPS) expect(() => svgFor(shop.imagePath)).not.toThrow()
  })

  it.each(shops)('%s is a complete svg document', (_id, shop) => {
    const svg = svgFor(shop.imagePath)
    expect(svg).toContain('<svg')
    expect(svg.trimEnd().endsWith('</svg>')).toBe(true)
  })

  it.each(shops)('%s contains no character that breaks XML parsing', (_id, shop) => {
    // Tab, newline and carriage return are the only control codes XML allows.
    const illegal = [...svgFor(shop.imagePath)]
      .filter((char) => {
        const code = char.codePointAt(0) ?? 0
        return code < 0x09 || code === 0x0b || code === 0x0c || (code >= 0x0e && code <= 0x1f)
      })
    expect(illegal.map((c) => c.codePointAt(0))).toEqual([])
  })

  it.each(shops)('%s shows every price its catalog claims', (_id, shop) => {
    const drawn = new Set([...svgFor(shop.imagePath).matchAll(/&#8377;(\d+)/g)].map((m) => Number(m[1])))
    const missing = shop.items.map((item) => item.pricePaise / 100).filter((rupees) => !drawn.has(rupees))
    expect(missing, `in the fixture but not on the image: ${missing.join(', ')}`).toEqual([])
  })

  it.each(shops)('%s shows no price its catalog does not have', (_id, shop) => {
    const known = new Set(shop.items.map((item) => item.pricePaise / 100))
    const drawn = [...svgFor(shop.imagePath).matchAll(/&#8377;(\d+)/g)].map((m) => Number(m[1]))
    const extra = [...new Set(drawn)].filter((rupees) => !known.has(rupees))
    expect(extra, `on the image with no catalog row: ${extra.join(', ')}`).toEqual([])
  })

  it.each(shops)('%s says on its face that it is a sample', (_id, shop) => {
    expect(svgFor(shop.imagePath).toUpperCase()).toContain('SAMPLE')
  })

  it('still offers the kirana shelf first', () => {
    // The judged five-minute run starts here, and `sampleCatalogs.test.ts` shows
    // why: on this catalog ₹45 resolves to a single basket, while on the rate
    // card it resolves to eight. Adding samples must not reorder the demo.
    expect(SAMPLE_SHOPS[0].id).toBe('meena-kirana-shelf')
  })
})

/**
 * Guards the photographs, which are a different promise from the drawings above.
 *
 * Tapping one of these runs the real OCR pipeline, so the bytes have to survive
 * `fetch` → `decodeImage` → `preprocess` in the browser. A truncated or
 * mislabelled file would surface as "nothing readable in that photo", which is
 * also the honest outcome for the shelf photo — so the failure would look like
 * the feature working. Hence checking the bytes here instead.
 *
 * `?inline` forces a base64 data URL regardless of size, which is the only way
 * to see the actual bytes without Node's `fs` (absent from this TS project).
 */
const photoSources = import.meta.glob('/public/demo/*.jpg', {
  query: '?inline',
  import: 'default',
  eager: true,
}) as Record<string, string>

function bytesFor(imagePath: string): Uint8Array {
  const key = `/public${imagePath}`
  const dataUrl = photoSources[key]
  if (!dataUrl) throw new Error(`${key} was not found. Known: ${Object.keys(photoSources).join(', ')}`)
  const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
  const binary = atob(base64)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0))
}

/** Reads width/height out of the first JPEG start-of-frame marker. */
function jpegSize(bytes: Uint8Array): { width: number; height: number } {
  for (let offset = 2; offset + 9 < bytes.length;) {
    if (bytes[offset] !== 0xff) {
      offset += 1
      continue
    }
    const marker = bytes[offset + 1]
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3]
    // Every SOFn except the DHT/DAC/DNL markers that share the 0xC_ range.
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      }
    }
    offset += 2 + length
  }
  throw new Error('no JPEG frame header found')
}

const photos = SAMPLE_PHOTOS.map((photo) => [photo.id, photo] as const)

/** Mirrors MAX_EDGE in ocr.ts. */
const MAX_EDGE = 1600
const SIZE_BUDGET_BYTES = 1_000_000

describe('sample photos', () => {
  it('every sample photo has a file on disk', () => {
    for (const photo of SAMPLE_PHOTOS) expect(() => bytesFor(photo.imagePath)).not.toThrow()
  })

  it.each(photos)('%s is a complete JPEG', (_id, photo) => {
    const bytes = bytesFor(photo.imagePath)
    expect([bytes[0], bytes[1]]).toEqual([0xff, 0xd8])
    // End-of-image marker: catches a file truncated in transit or by git-lfs.
    expect([bytes[bytes.length - 2], bytes[bytes.length - 1]]).toEqual([0xff, 0xd9])
  })

  it.each(photos)('%s stays inside the demo download budget', (_id, photo) => {
    const size = bytesFor(photo.imagePath).byteLength
    expect(size, `${(size / 1024).toFixed(0)} KB`).toBeLessThan(SIZE_BUDGET_BYTES)
  })

  it.each(photos)('%s needs no downscaling before OCR', (_id, photo) => {
    // Under MAX_EDGE the browser feeds the image to Tesseract untouched, which
    // is what lets server/verifySamplePhotoOcr.mjs skip resampling and still
    // describe the shipped read. A larger asset invalidates those numbers.
    const { width, height } = jpegSize(bytesFor(photo.imagePath))
    expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_EDGE)
  })

  it('never reuses a fixture drawing as a real-OCR photo', () => {
    // The two lists make opposite claims to the merchant, so an overlap would
    // put "read from the image" next to rows that were written by us.
    const drawings = new Set(SAMPLE_SHOPS.map((shop) => shop.imagePath))
    for (const photo of SAMPLE_PHOTOS) expect(drawings.has(photo.imagePath)).toBe(false)
  })

  it('declares an expectation for every photo', () => {
    // At least one of each, so the demo can show a successful read and a refusal.
    const kinds = SAMPLE_PHOTOS.map((photo) => photo.expectation)
    expect(kinds).toContain('reads_prices')
    expect(kinds).toContain('no_prices')
  })
})
