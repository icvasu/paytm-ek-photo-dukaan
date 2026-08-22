import type { VisionResult } from '../../types/models.js'
import type { ExtractionEvidence } from './catalogPipeline.js'

/**
 * Content-addressed memo of vision reads, keyed by the bytes of the image.
 *
 * The brief asks demo mode to cache vision by image hash. Two reasons, and only
 * the second is about speed:
 *
 * 1. Determinism. Re-reading the same photo returns the same rows. Tesseract is
 *    deterministic for identical input, but the pipeline downstream of it is
 *    not worth re-proving on stage, and a judge who taps the same sample twice
 *    should not see two different catalogs.
 * 2. Latency. A full read is seconds of WASM on a phone. A second tap on the
 *    same image should be instant rather than risk the OCR timeout on a slow
 *    venue device.
 *
 * The key is a hash of the image *content*, not the filename, so two different
 * photos that happen to share a name can never collide, and the same photo
 * re-picked under a different name still hits.
 */

export interface CachedVisionRead {
  result: VisionResult & { sourceImageName: string }
  evidence: ExtractionEvidence | null
}

/**
 * FNV-1a over the image bytes, run twice with different offset bases and
 * combined with the byte length.
 *
 * Deliberately not `crypto.subtle`: that is async, absent in some non-secure
 * contexts, and this is a cache key rather than a security boundary. Two
 * independent 32-bit lanes plus the length make an accidental collision between
 * two shop photos effectively impossible at demo scale.
 */
export function hashBytes(bytes: Uint8Array): string {
  let a = 0x811c9dc5
  let b = 0x01000193
  for (let index = 0; index < bytes.length; index += 1) {
    const byte = bytes[index]
    a = ((a ^ byte) * 0x01000193) >>> 0
    b = ((b + byte) * 0x85ebca6b) >>> 0
    b = (b ^ (b >>> 13)) >>> 0
  }
  const lane = (value: number) => value.toString(16).padStart(8, '0')
  return `${lane(a)}${lane(b)}${bytes.length.toString(16)}`
}

/** Hashes a Blob/File by its bytes. */
export async function hashBlob(blob: Blob): Promise<string> {
  return hashBytes(new Uint8Array(await blob.arrayBuffer()))
}

const cache = new Map<string, CachedVisionRead>()

/**
 * Cap the map so a long demo session cannot grow without bound. Sample photos
 * plus whatever a judge hands over stays far below this.
 */
const MAX_ENTRIES = 12

export function cachedVisionRead(hash: string): CachedVisionRead | null {
  return cache.get(hash) ?? null
}

export function rememberVisionRead(hash: string, entry: CachedVisionRead): void {
  if (cache.size >= MAX_ENTRIES && !cache.has(hash)) {
    const oldest = cache.keys().next()
    if (!oldest.done) cache.delete(oldest.value)
  }
  cache.set(hash, entry)
}

export function clearVisionCache(): void {
  cache.clear()
}

export function visionCacheSize(): number {
  return cache.size
}

/**
 * The sentence appended to a recalled read so the merchant is told the rows
 * came from the earlier read of this exact image rather than a fresh one.
 *
 * A cache that silently pretends to have re-read the photo would be the same
 * class of dishonesty as inventing rows.
 */
export const RECALL_NOTE = 'Recalled from the earlier read of this same image — identical bytes, so the rows are identical.'

export function withRecallNote(result: VisionResult & { sourceImageName: string }): VisionResult & { sourceImageName: string } {
  if (result.readingNote.includes(RECALL_NOTE)) return result
  return { ...result, readingNote: `${result.readingNote} ${RECALL_NOTE}` }
}
