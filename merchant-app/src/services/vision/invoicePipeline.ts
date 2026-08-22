import { bestMatch } from '../../intelligence/fuzzy.js'
import type { CatalogItem, SupplierInvoiceLine, SupplierProfile } from '../../types/models.js'
import { runOcr, OcrUnavailableError, type OcrPhase } from './ocr.js'
import type { RejectedLine } from './parseCatalog.js'
import { parseInvoiceLines, type ParsedInvoiceLine } from './parseInvoice.js'

/**
 * Composes the supplier bill pipeline:
 *
 *   photo → tesseract.js OCR → invoice row parsing → catalog SKU resolution
 *
 * The last stage matters more here than on a rate card. A bill row only becomes
 * useful once it points at a catalog item, because that is what lets restock
 * order it and stock-in update the right row. A row that cannot be matched is
 * kept and shown as unlinked rather than dropped or attached to a near miss.
 */

/** Below this the name match is not good enough to claim two names are the same product. */
const MATCH_THRESHOLD = 0.6

export interface ResolvedInvoiceLine extends SupplierInvoiceLine {
  /** True when this row was matched to an item already in the catalog. */
  linked: boolean
  /** What the merchant's catalog calls it, when matched. */
  catalogName: string | null
  arithmeticVerified: boolean
  confidencePct: number
  basis: string[]
  sourceLine: string
}

export interface InvoiceEvidence {
  engine: string
  linesRead: number
  rowsAccepted: number
  rowsRejected: number
  meanOcrConfidencePct: number
  durationMs: number
  rejected: RejectedLine[]
  resolved: ResolvedInvoiceLine[]
  linkedCount: number
  verifiedCount: number
  /** Total printed on the bill, when one was read. */
  readTotalPaise: number | null
  computedTotalPaise: number
  /** True when the printed total agreed with the rows we accepted. */
  totalAgrees: boolean | null
}

export class NoInvoiceFoundError extends Error {
  readonly rejected: RejectedLine[]
  readonly linesRead: number

  constructor(message: string, linesRead: number, rejected: RejectedLine[]) {
    super(message)
    this.name = 'NoInvoiceFoundError'
    this.linesRead = linesRead
    this.rejected = rejected
  }
}

let lastEvidence: { sourceImageName: string; evidence: InvoiceEvidence } | null = null

export function invoiceEvidenceFor(sourceImageName: string | undefined): InvoiceEvidence | null {
  if (!sourceImageName || !lastEvidence) return null
  return lastEvidence.sourceImageName === sourceImageName ? lastEvidence.evidence : null
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'line'
}

/** Matches one read row to a catalog item by name, or reports it unlinked. */
function resolveLine(line: ParsedInvoiceLine, catalog: CatalogItem[]): ResolvedInvoiceLine {
  const { best } = bestMatch<CatalogItem>(
    line.itemName,
    catalog,
    (item) => [item.name],
    MATCH_THRESHOLD,
  )
  const basis = [...line.basis]
  if (best) {
    basis.push(`matched your “${best.candidate.name}” (${Math.round(best.breakdown.score * 100)}% similar)`)
  } else if (catalog.length) {
    basis.push('no matching item in your catalog')
  }
  return {
    skuId: best ? best.candidate.id : slugify(line.itemName),
    // Use the catalog's own name when matched so reorder and stock-in line up.
    itemName: best ? best.candidate.name : line.itemName,
    quantity: line.quantity,
    unitCostPaise: line.unitCostPaise,
    linked: Boolean(best),
    catalogName: best ? best.candidate.name : null,
    arithmeticVerified: line.arithmeticVerified,
    confidencePct: line.confidencePct,
    basis,
    sourceLine: line.sourceLine,
  }
}

function readingNote(evidence: InvoiceEvidence, supplierNamed: boolean): string {
  const parts = [
    `Read ${evidence.linesRead} line${evidence.linesRead === 1 ? '' : 's'} off your bill with on-device OCR`,
    `kept ${evidence.rowsAccepted} as stock row${evidence.rowsAccepted === 1 ? '' : 's'}`,
  ]
  if (evidence.rowsRejected) parts.push(`skipped ${evidence.rowsRejected}`)
  parts.push(`${evidence.verifiedCount} had quantity × rate matching the printed amount`)
  parts.push(`${evidence.linkedCount} matched an item already in your catalog`)
  let note = `${parts.join(', ')}.`
  if (!supplierNamed) note += ' The supplier name could not be read — set it before ordering.'
  if (evidence.totalAgrees === false) {
    note += ' The printed bill total does not match these rows, so some rows were probably missed — check before ordering.'
  }
  return `${note} No payable, bank instruction or supplier API call was created.`
}

/**
 * Runs the real extraction pipeline on a supplier bill the user photographed.
 *
 * Throws rather than returning a plausible bill when no row yielded a quantity
 * and a unit cost. A guessed quantity would flow straight into the stock ledger
 * and the reorder amount, which is the one place this prototype must not guess.
 */
export async function analyzeInvoicePhoto(
  file: Blob,
  fileName: string,
  catalog: CatalogItem[],
  onPhase?: (phase: OcrPhase) => void,
): Promise<Omit<SupplierProfile, 'id' | 'lastStockInAt'>> {
  const outcome = await runOcr(file, onPhase)
  const parse = parseInvoiceLines(outcome.lines)

  if (!parse.lines.length) {
    lastEvidence = null
    throw new NoInvoiceFoundError(
      outcome.lines.length
        ? 'Text was read from this bill but no line gave both a quantity and a unit cost, so no supplier was saved. Try a straighter, closer shot of the item rows.'
        : 'No text could be read from this photo, so no supplier was saved. Try a closer, brighter shot of the bill.',
      parse.linesRead,
      parse.rejected,
    )
  }

  const resolved = parse.lines.map((line) => resolveLine(line, catalog))
  const computedTotalPaise = resolved.reduce((sum, line) => sum + line.quantity * line.unitCostPaise, 0)
  const totalAgrees = parse.readTotalPaise === null
    ? null
    : Math.abs(parse.readTotalPaise - computedTotalPaise) <= Math.max(200, computedTotalPaise * 0.02)

  const evidence: InvoiceEvidence = {
    engine: outcome.engine,
    linesRead: parse.linesRead,
    rowsAccepted: resolved.length,
    rowsRejected: parse.rejected.length,
    meanOcrConfidencePct: outcome.meanConfidence,
    durationMs: outcome.durationMs,
    rejected: parse.rejected,
    resolved,
    linkedCount: resolved.filter((line) => line.linked).length,
    verifiedCount: resolved.filter((line) => line.arithmeticVerified).length,
    readTotalPaise: parse.readTotalPaise,
    computedTotalPaise,
    totalAgrees,
  }
  lastEvidence = { sourceImageName: fileName, evidence }

  return {
    // Never invent a supplier. An unread name stays visibly unknown.
    name: parse.supplierName ?? 'Unnamed supplier',
    phone: parse.supplierPhone ?? '',
    sourceImageName: fileName,
    lines: resolved.map((line) => ({
      skuId: line.skuId,
      itemName: line.itemName,
      quantity: line.quantity,
      unitCostPaise: line.unitCostPaise,
    })),
    invoiceTotalPaise: computedTotalPaise,
    normalOrderPaise: computedTotalPaise,
    disclosure: readingNote(evidence, Boolean(parse.supplierName)),
  }
}

export { OcrUnavailableError }
export type { OcrPhase }
