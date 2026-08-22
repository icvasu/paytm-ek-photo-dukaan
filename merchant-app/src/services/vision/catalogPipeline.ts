import type { CatalogItem, VisionResult } from '../../types/models.js'
import { runOcr, OcrUnavailableError, type OcrOutcome, type OcrPhase } from './ocr.js'
import { parseCatalogLines, type ParseOutcome, type RejectedLine } from './parseCatalog.js'
import { resolveItems, type ResolvedItem } from './resolveItems.js'
import {
  findSamplePhoto, findSampleShop, loadSampleCatalog, loadSampleInvoice, sampleShopForCatalog,
} from './VisionService.js'

/**
 * Composes the catalog extraction pipeline:
 *
 *   photo → tesseract.js OCR → line parsing → fuzzy lexicon resolution
 *
 * Each stage lives in its own module; this file only wires them together and
 * records what happened so the UI can explain itself.
 */

export interface ExtractionEvidence {
  engine: string
  linesRead: number
  meanOcrConfidencePct: number
  durationMs: number
  processedWidth: number
  processedHeight: number
  resolved: ResolvedItem[]
  rejected: RejectedLine[]
  matchedCount: number
}

export class NoTextFoundError extends Error {
  /** Lines OCR produced but which contained no name/price pair. */
  readonly rejected: RejectedLine[]
  readonly linesRead: number

  constructor(message: string, linesRead: number, rejected: RejectedLine[]) {
    super(message)
    this.name = 'NoTextFoundError'
    this.linesRead = linesRead
    this.rejected = rejected
  }
}

/**
 * Evidence for the most recent extraction, held for the current page session.
 *
 * The catalog itself is persisted through the demo API; this per-run reasoning
 * is deliberately not, because it describes one photo, not the shop.
 */
let lastEvidence: { sourceImageName: string; evidence: ExtractionEvidence } | null = null

export function extractionEvidenceFor(sourceImageName: string | undefined): ExtractionEvidence | null {
  if (!sourceImageName || !lastEvidence) return null
  return lastEvidence.sourceImageName === sourceImageName ? lastEvidence.evidence : null
}

function toCatalogItem(item: ResolvedItem): CatalogItem {
  return {
    id: item.suggestedId,
    name: item.name,
    pricePaise: item.pricePaise,
    available: true,
    stockFlag: 'in_stock',
    // A photo of a price list shows prices, not counts. Saying so is more
    // useful than inventing a quantity.
    stockLabel: 'Count not read',
    category: item.category,
    source: 'ocr',
    confidencePct: item.confidencePct,
  }
}

function readingNote(outcome: OcrOutcome, parse: ParseOutcome, matched: number, sourceLabel: string): string {
  const parts = [
    `Read ${parse.linesRead} line${parse.linesRead === 1 ? '' : 's'} off ${sourceLabel} with on-device OCR`,
    `kept ${parse.items.length} as priced item${parse.items.length === 1 ? '' : 's'}`,
  ]
  if (parse.rejected.length) parts.push(`skipped ${parse.rejected.length}`)
  parts.push(`${matched} matched a known product`)
  return `${parts.join(', ')}. Average text confidence ${outcome.meanConfidence}%. Stock counts were not read — check every row before sharing.`
}

/**
 * Runs the real extraction pipeline on a photo the user supplied.
 *
 * Throws rather than returning a plausible catalog when nothing readable was
 * found. Inventing rows would make the demo look better and the product a lie.
 */
export async function analyzePhoto(
  file: Blob,
  fileName: string,
  onPhase?: (phase: OcrPhase) => void,
  /**
   * How to refer to the image in the note the merchant reads. Only the wording
   * changes; a sample photo is put through the identical pipeline.
   */
  sourceLabel = 'your photo',
): Promise<VisionResult & { sourceImageName: string }> {
  const outcome = await runOcr(file, onPhase)
  const parse = parseCatalogLines(outcome.lines)

  if (!parse.items.length) {
    lastEvidence = null
    throw new NoTextFoundError(
      outcome.lines.length
        ? `Text was read from this photo but no line looked like an item with a price, so no catalog was created. Try a closer shot of the price list, or add items by hand.`
        : 'No text could be read from this photo, so no catalog was created. Try a closer, brighter shot of a shelf label or price list.',
      parse.linesRead,
      parse.rejected,
    )
  }

  const resolved = resolveItems(parse.items)
  const matchedCount = resolved.filter((item) => item.matched).length

  lastEvidence = {
    sourceImageName: fileName,
    evidence: {
      engine: outcome.engine,
      linesRead: parse.linesRead,
      meanOcrConfidencePct: outcome.meanConfidence,
      durationMs: outcome.durationMs,
      processedWidth: outcome.processedWidth,
      processedHeight: outcome.processedHeight,
      resolved,
      rejected: parse.rejected,
      matchedCount,
    },
  }

  const meanConfidence = resolved.reduce((sum, item) => sum + item.confidencePct, 0) / resolved.length

  return {
    items: resolved.map(toCatalogItem),
    // Confidence describes the read, so it must come from the read.
    confidence: meanConfidence >= 70 ? 'high' : meanConfidence >= 50 ? 'medium' : 'starter',
    readingNote: readingNote(outcome, parse, matchedCount, sourceLabel),
    sourceKind: 'upload',
    sourceImageName: fileName,
    provenance: {
      method: 'device_ocr',
      engine: outcome.engine,
      linesRead: parse.linesRead,
      rowsAccepted: parse.items.length,
      rowsRejected: parse.rejected.length,
      meanOcrConfidencePct: outcome.meanConfidence,
      durationMs: outcome.durationMs,
    },
  }
}

/** Loads one of the pre-written sample shops. Labelled as a fixture, not a read. */
export function analyzeSample(shopId: string): VisionResult & { sourceImageName: string } {
  const shop = findSampleShop(shopId)
  if (!shop) throw new Error('That sample shop is not available.')
  lastEvidence = null
  return loadSampleCatalog(shop)
}

/**
 * Reads a sample photograph that ships with the app, for real.
 *
 * This exists so the demo can prove OCR works without depending on the venue's
 * lighting or a judge's willingness to hand over their phone. It fetches the
 * image and hands it to `analyzePhoto` — the same function the file picker
 * calls, with no flag threaded through it. There is deliberately no fixture to
 * fall back on: if the read finds nothing, this throws NoTextFoundError exactly
 * as a user's own unreadable photo would, because a sample that quietly
 * substitutes pre-written rows would make the honesty claim worthless.
 */
export async function analyzeSamplePhoto(
  photoId: string,
  onPhase?: (phase: OcrPhase) => void,
): Promise<VisionResult & { sourceImageName: string }> {
  const photo = findSamplePhoto(photoId)
  if (!photo) throw new Error('That sample photo is not available.')

  const response = await fetch(photo.imagePath)
  if (!response.ok) throw new Error(`The sample photo could not be loaded (HTTP ${response.status}).`)
  const blob = await response.blob()

  return analyzePhoto(blob, photo.fileName, onPhase, 'this sample photo')
}

export { OcrUnavailableError, loadSampleInvoice, sampleShopForCatalog, findSampleShop, findSamplePhoto }
export type { OcrPhase, ResolvedItem, RejectedLine }
