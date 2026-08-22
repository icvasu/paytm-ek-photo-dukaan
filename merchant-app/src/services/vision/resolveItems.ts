import { bestMatch, editSimilarity, type SimilarityBreakdown } from '../../intelligence/fuzzy.js'
import {
  CATEGORY_FALLBACK, describeBand, lexiconAliases, priceBandFit,
  PRODUCT_LEXICON, type LexiconEntry,
} from '../../intelligence/lexicon.js'
import type { ParsedItem } from './parseCatalog.js'
import { readPackSize, samePackSize, stripPackSize } from './packSize.js'

/** Why one catalog row looks the way it does. Rendered in the UI verbatim. */
export interface ItemEvidence {
  /** Exactly what OCR read for this row. */
  ocrText: string
  /** The name after price removal, before lexicon resolution. */
  parsedName: string
  /** Alias in the lexicon that matched, if any. */
  matchedAlias: string | null
  /** Canonical product this was resolved to, if any. */
  matchedProduct: string | null
  similarity: SimilarityBreakdown | null
  /** Next-best lexicon entry, when the match was close. */
  runnerUp: string | null
  /** Typical price window for the matched product. */
  priceBand: string | null
  /** 0..1 fit of the read price inside that window. */
  priceBandFit: number | null
  /** OCR engine confidence for the source line, 0..100. */
  ocrConfidencePct: number
  /** Pack size the photo actually printed, if it printed one. */
  printedPackSize: string | null
  /** Pack size carried by the matched lexicon entry, if any. */
  lexiconPackSize: string | null
  /** True when the displayed name is the printed text rather than the lexicon's. */
  nameKeptAsPrinted: boolean
  /** Why the displayed name looks the way it does, for the evidence panel. */
  nameNote: string
  /** Human-readable signals, in the order they were applied. */
  signals: string[]
}

export interface ResolvedItem {
  /**
   * What to show. The canonical lexicon name when it agrees with every fact the
   * photo printed, otherwise the read name unchanged.
   */
  name: string
  pricePaise: number
  category: string
  /** Final 5–95 confidence after all signals. */
  confidencePct: number
  /** Stable id from the lexicon, or derived from the read name. */
  suggestedId: string
  matched: boolean
  evidence: ItemEvidence
}

/** Below this the lexicon match is not trustworthy enough to rename a row. */
const MATCH_THRESHOLD = 0.62
/** Above this the top match is treated as decided even if a runner-up is close. */
const DECISIVE_MARGIN = 0.08
/**
 * How close the lexicon name has to be to the printed text, once both have had
 * their pack size removed, before its spelling is used instead. High on purpose:
 * this is only meant to fix "Colgato" into "Colgate", never to turn
 * "Britannia Bread" into a different product's name.
 */
const SPELLING_THRESHOLD = 0.88

/**
 * Chooses the name shown on screen.
 *
 * The rule is that the photo owns every fact it states. The lexicon still
 * decides what the row *is* — its category, its id, its price band — but it
 * never gets to restate a printed pack size as a different one, and it never
 * gets to add a pack size the card did not print. Those two moves are what make
 * an otherwise correct read look invented.
 */
function chooseName(printed: string, canonical: string): { name: string; note: string; keptAsPrinted: boolean } {
  const printedPack = readPackSize(printed)
  const lexiconPack = readPackSize(canonical)

  if (printedPack && !samePackSize(printedPack, lexiconPack)) {
    return {
      name: printed,
      keptAsPrinted: true,
      note: lexiconPack
        ? `kept the printed “${printedPack.text}” — the lexicon entry reads “${lexiconPack.text}”`
        : `kept the printed “${printedPack.text}” — the lexicon entry states no pack size`,
    }
  }

  if (!printedPack && lexiconPack) {
    const withoutPack = stripPackSize(canonical)
    if (withoutPack && editSimilarity(printed, withoutPack) >= SPELLING_THRESHOLD) {
      return {
        name: withoutPack,
        keptAsPrinted: false,
        note: `lexicon spelling, without its “${lexiconPack.text}” — the photo printed no pack size`,
      }
    }
    return {
      name: printed,
      keptAsPrinted: true,
      note: `no pack size printed, so the lexicon’s “${lexiconPack.text}” was not added`,
    }
  }

  // Neither side states a pack size the other contradicts. A read name that is
  // longer than our entry is carrying detail worth keeping (a brand the lexicon
  // does not list); otherwise the canonical spelling is the better rendering of
  // the same thing.
  const printedIsMoreSpecific = printed.length > canonical.length + 4
  return {
    name: printedIsMoreSpecific ? printed : canonical,
    keptAsPrinted: printedIsMoreSpecific,
    note: printedIsMoreSpecific
      ? 'kept as printed — more specific than the lexicon name'
      : 'lexicon name, which states the same pack size that was printed',
  }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'item'
}

/**
 * Resolves parsed OCR rows against the product lexicon.
 *
 * The read price is never overwritten and an unmatched row is never dropped or
 * renamed to something plausible: it is kept exactly as read, marked unmatched,
 * and its confidence is lowered so the merchant reviews it.
 *
 * A match is also not allowed to restate the printed pack size — see
 * `chooseName` — so a card reading "Surf Excel 1 kg" is never shown as the
 * lexicon's "500 g".
 */
export function resolveItems(parsed: ParsedItem[]): ResolvedItem[] {
  const usedIds = new Set<string>()

  return parsed.map((item) => {
    const { best, runnerUp } = bestMatch<LexiconEntry>(
      item.name,
      PRODUCT_LEXICON,
      lexiconAliases,
      MATCH_THRESHOLD,
    )

    const signals = [...item.basis]
    // parseCatalog reports OCR confidence as a percentage in `basis`; recover
    // the numeric value it already folded into confidencePct.
    const ocrConfidencePct = Number(/OCR (\d+)%/.exec(item.basis.join(' '))?.[1] ?? item.confidencePct)
    let score = item.confidencePct / 100

    let name = item.name
    let category = item.category
    let suggestedId = slugify(item.name)
    let bandFit: number | null = null
    let band: string | null = null
    const printedPack = readPackSize(item.name)
    let lexiconPack: string | null = null
    let nameKeptAsPrinted = true
    let nameNote = 'kept exactly as read'

    if (best) {
      const margin = runnerUp ? best.breakdown.score - runnerUp.breakdown.score : 1
      const ambiguous = margin < DECISIVE_MARGIN
      bandFit = priceBandFit(best.candidate, item.pricePaise)
      band = describeBand(best.candidate)

      // Name similarity and price plausibility are independent evidence, so
      // they multiply. A confident name with an absurd price stays low.
      score *= 0.55 + 0.45 * best.breakdown.score
      score *= 0.6 + 0.4 * bandFit

      signals.push(`matched “${best.matchedOn}” (${Math.round(best.breakdown.score * 100)}% similar)`)
      signals.push(`price ${bandFit >= 0.99 ? 'inside' : 'outside'} typical ${band}`)

      if (ambiguous && runnerUp) {
        score *= 0.85
        signals.push(`close call with ${runnerUp.candidate.name}`)
      }

      const chosen = chooseName(item.name, best.candidate.name)
      name = chosen.name
      nameKeptAsPrinted = chosen.keptAsPrinted
      nameNote = chosen.note
      lexiconPack = readPackSize(best.candidate.name)?.text ?? null
      signals.push(`name: ${chosen.note}`)
      // The lexicon still supplies identity even when it does not supply the
      // name, so stock and restock can recognise the row later.
      category = best.candidate.category
      suggestedId = best.candidate.id
    } else {
      // Unmatched is a real answer, not a failure to hide.
      score *= 0.7
      category = item.category === 'General' ? CATEGORY_FALLBACK : item.category
      signals.push('no lexicon match — kept exactly as read')
    }

    let id = suggestedId
    let suffix = 2
    while (usedIds.has(id)) {
      id = `${suggestedId}-${suffix}`
      suffix += 1
    }
    usedIds.add(id)

    return {
      name,
      pricePaise: item.pricePaise,
      category,
      confidencePct: Math.max(5, Math.min(95, Math.round(score * 100))),
      suggestedId: id,
      matched: Boolean(best),
      evidence: {
        ocrText: item.sourceLine,
        parsedName: item.name,
        matchedAlias: best?.matchedOn ?? null,
        matchedProduct: best?.candidate.name ?? null,
        similarity: best?.breakdown ?? null,
        runnerUp: runnerUp?.candidate.name ?? null,
        priceBand: band,
        priceBandFit: bandFit,
        ocrConfidencePct: Number.isFinite(ocrConfidencePct) ? ocrConfidencePct : item.confidencePct,
        printedPackSize: printedPack?.text ?? null,
        lexiconPackSize: lexiconPack,
        nameKeptAsPrinted,
        nameNote,
        signals,
      },
    }
  })
}
