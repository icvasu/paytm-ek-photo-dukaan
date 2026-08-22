import { describe, expect, it } from 'vitest'
import { editSimilarity, levenshtein, similarity, tokenCoverage, tokenSetRatio } from './fuzzy.js'
import { dailyDecayForHalfLife, exponentiallyWeightedRate } from './demand.js'
import { lexiconAliases, priceBandFit, PRODUCT_LEXICON } from './lexicon.js'
import { bestMatch } from './fuzzy.js'
import type { LexiconEntry } from './lexicon.js'

describe('levenshtein', () => {
  it('matches known distances', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3)
    expect(levenshtein('', 'abc')).toBe(3)
    expect(levenshtein('same', 'same')).toBe(0)
  })

  it('honours the early-exit bound', () => {
    expect(levenshtein('abcdefgh', 'zzzzzzzz', 3)).toBeGreaterThan(3)
  })
})

describe('editSimilarity', () => {
  it('is 1 for identical strings after normalisation', () => {
    expect(editSimilarity('Parle-G  250g', 'parle g 250 g')).toBe(1)
  })

  it('degrades smoothly with character noise', () => {
    expect(editSimilarity('aashirvaad', 'aashinvaad')).toBeGreaterThan(0.85)
    expect(editSimilarity('aashirvaad', 'lifebuoy')).toBeLessThan(0.3)
  })
})

describe('tokenSetRatio', () => {
  it('ignores extra words on one side', () => {
    expect(tokenSetRatio('atta', 'aashirvaad atta 5 kg')).toBeGreaterThan(tokenSetRatio('atta', 'lifebuoy soap'))
  })

  it('is order independent', () => {
    expect(tokenSetRatio('good day britannia', 'britannia good day')).toBe(1)
  })
})

describe('tokenCoverage', () => {
  it('tolerates a one-character slip per token', () => {
    expect(tokenCoverage('maggi masala', 'maggie masala')).toBe(1)
  })

  it('reports partial coverage honestly', () => {
    expect(tokenCoverage('surf excel', 'surf excel easy wash 500 g')).toBe(1)
    expect(tokenCoverage('random unknown thing', 'tata salt 1 kg')).toBeLessThan(0.4)
  })
})

describe('lexicon matching', () => {
  const match = (query: string) =>
    bestMatch<LexiconEntry>(query, PRODUCT_LEXICON, lexiconAliases, 0.62).best

  it('resolves realistic OCR noise to the right product', () => {
    const cases: [string, string][] = [
      ['Aashinvaad Atta 5kg', 'aashirvaad-atta'],
      ['PARLE-G', 'parle-g'],
      ['Maggie Masala 70g', 'maggi'],
      ['Thums Up 750ml', 'thums-up'],
      ['Surf Excel', 'surf-excel'],
      ['Tata Namak', 'tata-salt'],
      ['masala chai', 'chai'],
      ['Lifebuoy soap', 'lifebuoy'],
      ['toor daal', 'toor-dal'],
      ['Amul Taaza', 'amul-milk'],
    ]
    for (const [query, expectedId] of cases) {
      expect(match(query)?.candidate.id, query).toBe(expectedId)
    }
  })

  it('returns no match for text that is not a product', () => {
    for (const query of ['zzzqqq', 'GSTIN 27AAAPL1234C', 'Thank you visit again']) {
      expect(match(query), query).toBeNull()
    }
  })

  it('exposes the alias it matched on for the UI', () => {
    const best = match('Maggie Masala 70g')
    expect(best?.matchedOn).toBeTruthy()
    expect(best?.breakdown.score).toBeGreaterThan(0.62)
  })
})

describe('priceBandFit', () => {
  const parleG = PRODUCT_LEXICON.find((item) => item.id === 'parle-g')!

  it('is 1 inside the band and falls off outside it', () => {
    expect(priceBandFit(parleG, 2500)).toBe(1)
    expect(priceBandFit(parleG, 85000)).toBeLessThan(0.05)
  })
})

describe('exponentiallyWeightedRate', () => {
  const decay = dailyDecayForHalfLife(3.5)

  it('weights recent days more heavily than old ones', () => {
    const rising = exponentiallyWeightedRate([0, 0, 0, 4], decay)
    const falling = exponentiallyWeightedRate([4, 0, 0, 0], decay)
    expect(rising).toBeGreaterThan(falling)
  })

  it('halves the weight of a sale one half-life old', () => {
    expect(Math.pow(dailyDecayForHalfLife(4), 4)).toBeCloseTo(0.5, 10)
  })

  it('reproduces a steady rate exactly, so the units really are per day', () => {
    expect(exponentiallyWeightedRate([3, 3, 3, 3, 3], decay)).toBeCloseTo(3, 10)
    expect(exponentiallyWeightedRate([2], decay)).toBeCloseTo(2, 10)
  })

  it('stays between the smallest and largest day in the series', () => {
    const rate = exponentiallyWeightedRate([0, 7, 1, 4, 2], decay)
    expect(rate).toBeGreaterThanOrEqual(0)
    expect(rate).toBeLessThanOrEqual(7)
  })

  it('returns zero for an empty series', () => {
    expect(exponentiallyWeightedRate([], decay)).toBe(0)
  })
})

describe('similarity blend', () => {
  it('stays within 0..1', () => {
    for (const [a, b] of [['a', 'b'], ['maggi', 'maggi'], ['', 'x'], ['long product name here', 'x']]) {
      const result = similarity(a, b)
      expect(result.score).toBeGreaterThanOrEqual(0)
      expect(result.score).toBeLessThanOrEqual(1)
    }
  })
})
