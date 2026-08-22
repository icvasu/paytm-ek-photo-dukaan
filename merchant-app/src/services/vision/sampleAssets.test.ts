import { describe, expect, it } from 'vitest'
import { SAMPLE_SHOPS } from './VisionService.js'

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
})
