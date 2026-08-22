import type { CatalogItem, VisionResult } from '../../types/models.ts'
import { runOcr, OcrUnavailableError, type OcrOutcome, type OcrPhase } from './ocr.ts'
import { parseCatalogLines, type ParseOutcome, type RejectedLine } from './parseCatalog.ts'
import { resolveItems, type ResolvedItem } from './resolveItems.ts'
import { findSampleShop, loadSampleCatalog, loadSampleInvoice, sampleShopForCatalog } from './VisionService.ts'

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

function readingNote(outcome: OcrOutcome, parse: ParseOutcome, matched: number): string {
  const parts = [
    `Read ${parse.linesRead} line${parse.linesRead === 1 ? '' : 's'} off your photo with on-device OCR`,
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
    readingNote: readingNote(outcome, parse, matchedCount),
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

export { OcrUnavailableError, loadSampleInvoice, sampleShopForCatalog, findSampleShop }
export type { OcrPhase, ResolvedItem, RejectedLine }
