/**
 * The brief asks demo mode to cache vision by image hash. These tests pin the
 * two properties that make such a cache safe rather than merely fast: it is
 * keyed on content (so one photo can never serve another photo's rows), and a
 * recalled read says on screen that it was recalled.
 */
import { beforeEach, describe, expect, it } from 'vitest'
import {
  cachedVisionRead, clearVisionCache, hashBlob, hashBytes, RECALL_NOTE,
  rememberVisionRead, visionCacheSize, withRecallNote,
} from './photoCache.js'
import type { VisionResult } from '../../types/models.js'

const result = (name: string): VisionResult & { sourceImageName: string } => ({
  items: [{
    id: 'thums-up', name: 'Thums Up 750 ml', pricePaise: 4500, available: true,
    stockFlag: 'in_stock', stockLabel: 'Count not read', category: 'Drinks', source: 'ocr',
  }],
  confidence: 'high',
  readingNote: `Read 1 line off ${name}.`,
  sourceKind: 'upload',
  sourceImageName: name,
  provenance: {
    method: 'device_ocr', engine: 'tesseract.js', linesRead: 1, rowsAccepted: 1,
    rowsRejected: 0, meanOcrConfidencePct: 88, durationMs: 1200,
  },
})

beforeEach(() => clearVisionCache())

describe('content hashing', () => {
  it('gives identical bytes the same key', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5])
    const b = new Uint8Array([1, 2, 3, 4, 5])
    expect(hashBytes(a)).toBe(hashBytes(b))
  })

  it('separates images that differ by a single byte', () => {
    expect(hashBytes(new Uint8Array([1, 2, 3]))).not.toBe(hashBytes(new Uint8Array([1, 2, 4])))
  })

  it('separates images of different length that share a prefix', () => {
    expect(hashBytes(new Uint8Array([9, 9]))).not.toBe(hashBytes(new Uint8Array([9, 9, 9])))
  })

  it('separates byte-order permutations', () => {
    expect(hashBytes(new Uint8Array([1, 2]))).not.toBe(hashBytes(new Uint8Array([2, 1])))
  })

  it('hashes a Blob by its bytes, not its name', async () => {
    const bytes = new Uint8Array([7, 7, 7, 7])
    const first = new Blob([bytes], { type: 'image/jpeg' })
    const second = new Blob([bytes], { type: 'image/png' })
    expect(await hashBlob(first)).toBe(await hashBlob(second))
  })

  it('does not collide across a spread of realistic image sizes', () => {
    const seen = new Set<string>()
    for (let size = 1; size <= 400; size += 1) {
      const bytes = new Uint8Array(size)
      for (let index = 0; index < size; index += 1) bytes[index] = (index * 31 + size) % 256
      seen.add(hashBytes(bytes))
    }
    expect(seen.size).toBe(400)
  })
})

describe('the cache', () => {
  it('returns nothing for an image it has not seen', () => {
    expect(cachedVisionRead('nope')).toBeNull()
  })

  it('recalls the stored read for the same key', () => {
    rememberVisionRead('key-a', { result: result('shelf.jpg'), evidence: null })
    expect(cachedVisionRead('key-a')?.result.sourceImageName).toBe('shelf.jpg')
  })

  it('never serves one image\'s rows for another image', () => {
    rememberVisionRead('key-a', { result: result('shelf.jpg'), evidence: null })
    rememberVisionRead('key-b', { result: result('ratecard.jpg'), evidence: null })
    expect(cachedVisionRead('key-a')?.result.sourceImageName).toBe('shelf.jpg')
    expect(cachedVisionRead('key-b')?.result.sourceImageName).toBe('ratecard.jpg')
  })

  it('is bounded so a long demo cannot grow it without limit', () => {
    for (let index = 0; index < 40; index += 1) {
      rememberVisionRead(`key-${index}`, { result: result(`photo-${index}.jpg`), evidence: null })
    }
    expect(visionCacheSize()).toBeLessThanOrEqual(12)
  })

  it('clears completely, so a demo reset really starts over', () => {
    rememberVisionRead('key-a', { result: result('shelf.jpg'), evidence: null })
    clearVisionCache()
    expect(visionCacheSize()).toBe(0)
    expect(cachedVisionRead('key-a')).toBeNull()
  })
})

describe('a recalled read is labelled as recalled', () => {
  it('appends the recall note so the screen does not imply a fresh read', () => {
    const noted = withRecallNote(result('shelf.jpg'))
    expect(noted.readingNote).toContain(RECALL_NOTE)
  })

  it('does not stack the note when recalled twice', () => {
    const once = withRecallNote(result('shelf.jpg'))
    const twice = withRecallNote(once)
    expect(twice.readingNote.match(new RegExp(RECALL_NOTE, 'g'))).toHaveLength(1)
  })

  it('keeps the original provenance, because that read is what produced these rows', () => {
    const noted = withRecallNote(result('shelf.jpg'))
    expect(noted.provenance?.method).toBe('device_ocr')
    expect(noted.provenance?.engine).toBe('tesseract.js')
    expect(noted.items).toHaveLength(1)
  })
})
