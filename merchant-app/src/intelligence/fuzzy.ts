/**
 * String similarity for matching OCR output to a product lexicon.
 *
 * OCR of a shelf label is wrong in two different ways at once: characters get
 * misread ("Aashinvaad"), and words get dropped, reordered or padded with pack
 * sizes ("Atta 5kg Aashirvaad ATTA"). One metric cannot see both, so this
 * module implements two and combines them.
 */

/**
 * Lowercase, drop punctuation, collapse whitespace, and split digit/letter
 * boundaries so a pack size reads the same however it was printed: "250g",
 * "250 g" and "250-G" all normalise to "250 g".
 */
export function normalize(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097F]+/g, ' ')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/\s+/g, ' ')
    .trim()
}

export function tokenize(value: string): string[] {
  const normalized = normalize(value)
  return normalized ? normalized.split(' ') : []
}

/**
 * Levenshtein edit distance, two-row dynamic programme.
 *
 * `maxDistance` lets a caller abandon a comparison that is already too far
 * apart, which matters because the lexicon is scanned for every OCR line.
 */
export function levenshtein(a: string, b: string, maxDistance = Number.POSITIVE_INFINITY): number {
  if (a === b) return 0
  if (!a.length) return b.length
  if (!b.length) return a.length
  if (Math.abs(a.length - b.length) > maxDistance) return maxDistance + 1

  let previous = new Array<number>(b.length + 1)
  let current = new Array<number>(b.length + 1)
  for (let column = 0; column <= b.length; column += 1) previous[column] = column

  for (let row = 1; row <= a.length; row += 1) {
    current[0] = row
    let rowMinimum = current[0]
    const source = a.charCodeAt(row - 1)
    for (let column = 1; column <= b.length; column += 1) {
      const substitution = previous[column - 1] + (source === b.charCodeAt(column - 1) ? 0 : 1)
      const deletion = previous[column] + 1
      const insertion = current[column - 1] + 1
      const best = substitution < deletion
        ? (substitution < insertion ? substitution : insertion)
        : (deletion < insertion ? deletion : insertion)
      current[column] = best
      if (best < rowMinimum) rowMinimum = best
    }
    // Every remaining row can only increase the distance, so bail out early.
    if (rowMinimum > maxDistance) return maxDistance + 1
    const swap = previous
    previous = current
    current = swap
  }
  return previous[b.length]
}

/** Edit distance mapped to 0..1, where 1 is identical. Length-independent. */
export function editSimilarity(a: string, b: string): number {
  const left = normalize(a)
  const right = normalize(b)
  if (!left && !right) return 1
  const longest = Math.max(left.length, right.length)
  if (!longest) return 0
  return 1 - levenshtein(left, right) / longest
}

/**
 * Token-set ratio, in the spirit of the classic fuzzy-string implementation:
 * compare the shared tokens against each side's remainder, so extra words on
 * one side ("500 g", brand repeated) cost far less than a genuine mismatch.
 */
export function tokenSetRatio(a: string, b: string): number {
  const left = new Set(tokenize(a))
  const right = new Set(tokenize(b))
  if (!left.size && !right.size) return 1
  if (!left.size || !right.size) return 0

  const shared: string[] = []
  const leftOnly: string[] = []
  const rightOnly: string[] = []
  for (const token of left) (right.has(token) ? shared : leftOnly).push(token)
  for (const token of right) if (!left.has(token)) rightOnly.push(token)

  shared.sort()
  leftOnly.sort()
  rightOnly.sort()

  const base = shared.join(' ')
  const leftCombined = [base, leftOnly.join(' ')].filter(Boolean).join(' ')
  const rightCombined = [base, rightOnly.join(' ')].filter(Boolean).join(' ')

  return Math.max(
    editSimilarity(base, leftCombined),
    editSimilarity(base, rightCombined),
    editSimilarity(leftCombined, rightCombined),
  )
}

/**
 * Fraction of query tokens that have a close partner in the candidate. Catches
 * the case where OCR read only one word of a two-word product name.
 */
export function tokenCoverage(query: string, candidate: string): number {
  const queryTokens = tokenize(query)
  if (!queryTokens.length) return 0
  const candidateTokens = tokenize(candidate)
  if (!candidateTokens.length) return 0
  let covered = 0
  for (const token of queryTokens) {
    const hit = candidateTokens.some((other) => {
      if (other === token) return true
      if (token.length >= 4 && other.includes(token)) return true
      if (other.length >= 4 && token.includes(other)) return true
      // One or two character slips on a short word are still the same word.
      const allowed = token.length <= 4 ? 1 : 2
      return levenshtein(token, other, allowed) <= allowed
    })
    if (hit) covered += 1
  }
  return covered / queryTokens.length
}

export interface SimilarityBreakdown {
  /** Weighted blend of the three signals below, 0..1. */
  score: number
  editSimilarity: number
  tokenSetRatio: number
  tokenCoverage: number
}

/**
 * Blended similarity. Token-set carries the most weight because word-level
 * evidence survives OCR noise better than character-level evidence.
 */
export function similarity(query: string, candidate: string): SimilarityBreakdown {
  const edit = editSimilarity(query, candidate)
  const tokenSet = tokenSetRatio(query, candidate)
  const coverage = tokenCoverage(query, candidate)
  return {
    score: 0.3 * edit + 0.45 * tokenSet + 0.25 * coverage,
    editSimilarity: edit,
    tokenSetRatio: tokenSet,
    tokenCoverage: coverage,
  }
}

export interface FuzzyMatch<T> {
  candidate: T
  /** The specific alias string that matched, for the "why" in the UI. */
  matchedOn: string
  breakdown: SimilarityBreakdown
}

/**
 * Best entry whose score clears `threshold`, plus the runner-up so callers can
 * tell a confident match from a coin-flip between two similar products.
 */
export function bestMatch<T>(
  query: string,
  candidates: T[],
  aliasesOf: (candidate: T) => string[],
  threshold = 0.62,
): { best: FuzzyMatch<T> | null; runnerUp: FuzzyMatch<T> | null } {
  const scored: FuzzyMatch<T>[] = []
  for (const candidate of candidates) {
    let bestForCandidate: FuzzyMatch<T> | null = null
    for (const alias of aliasesOf(candidate)) {
      const breakdown = similarity(query, alias)
      if (!bestForCandidate || breakdown.score > bestForCandidate.breakdown.score) {
        bestForCandidate = { candidate, matchedOn: alias, breakdown }
      }
    }
    if (bestForCandidate) scored.push(bestForCandidate)
  }
  scored.sort((a, b) => b.breakdown.score - a.breakdown.score)
  const best = scored[0] && scored[0].breakdown.score >= threshold ? scored[0] : null
  return { best, runnerUp: best ? scored[1] ?? null : null }
}
