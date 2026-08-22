# Print-ready scan targets

Assets in this folder exist to be **printed on paper and photographed live**. They are
deliberately *not* registered in `SAMPLE_SHOPS` or `SAMPLE_PHOTOS`, and nothing in `src/`
references them. That is the whole point: if a judge photographs a sheet the app has never
seen, a correct read cannot have come from a bundled fixture.

## `gupta-general-store-price-list.png`

A photograph of a printed A4 price list headed **GUPTA GENERAL STORE / PRICE LIST**, ten
rows, prices as plain numbers with no `₹` symbol. The products are chosen to differ from
the bundled Meena Kirana catalog, so some rows have no lexicon entry at all.

- 1024×1536 px, long edge 1536 px — under the pipeline's 1600 px cap, so the browser feeds
  it to the engine at full size without resampling.
- `pHYs` is set to 131 dpi, so printing at 100% fills A4 height (198.6 × 297.8 mm). The
  white sheet inside the photo lands at about 171 × 249 mm. Item text prints 8–11 mm tall.
- The pixel data is byte-identical to the asset the measurement below was taken from; only
  the print-resolution chunk was added.

### What the real pipeline reads from it

Measured through the shipped path — `preprocess` → `tesseract.js` → `parseCatalogLines` →
`resolveItems` — not asserted:

**12 lines read, 93% mean text confidence, 10 of 10 priced rows kept, 0 price errors.**
The two skipped lines are the shop name and the words "PRICE LIST", both rejected as
"No price found on this line".

| # | Raw OCR line | Shown as | Price | Conf | Lexicon |
|---|---|---|---|---|---|
| 1 | `Bisleri Water 1L 20` | Bisleri Water 1 L | ₹20 | 76% | matched `bisleri` → Water Bottle 1 L |
| 2 | `Dairy Milk 50 g 45` | Dairy Milk 50 g | ₹45 | 60% | no match — kept as printed |
| 3 | `Good Day Biscuit 30` | Good Day Biscuit | ₹30 | 85% | matched `good day` → Britannia Good Day 200 g |
| 4 | `Lays Classic 52g 20` | Lays Classic 52 g | ₹20 | 75% | matched → Lays 52 g |
| 5 | `Kissan Jam 200 g 95` | Kissan Jam 200 g | ₹95 | 57% | no match — kept as printed |
| 6 | `Nescafe Classic 50 g 180` | Nescafe Classic 50 g | ₹180 | 63% | no match — kept as printed |
| 7 | `Dettol Soap 125 g 42` | Dettol Soap 125 g | ₹42 | 74% | matched → Lifebuoy Soap 125 g (70%) |
| 8 | `Harpic 500 ml 99` | Harpic 500 ml | ₹99 | 85% | matched → Harpic 500 ml (100%) |
| 9 | `Vim Bar 200 g 20` | Vim Bar 200 g | ₹20 | 79% | matched → Vim Bar 200 g (100%) |
| 10 | `Bournvita 500 g 255` | Bournvita 500 g | ₹255 | 60% | no match — kept as printed |

Every printed price is read exactly. Six of ten rows matched a lexicon product; the four
that did not are kept with the name the card printed, marked unmatched, and scored lower so
they get reviewed — they are not dropped and not renamed to something plausible.

Two rows are worth knowing about before anyone opens the evidence panel in front of an
audience. **Dettol Soap 125 g** matches the lexicon's *Lifebuoy Soap 125 g* at 70% on the
strength of "Soap 125 g", so the row carries the `lifebuoy` id — the displayed name stays
"Dettol Soap 125 g", which is what `chooseName` is for, but the evidence panel names
Lifebuoy. **Nescafe Classic 50 g** is filed under *Dairy*, because the category rules
substring-match and "c**lassi**c" contains "lassi".

### Amount attribution on this catalog

Three rows share ₹20 (Bisleri Water, Lays Classic, Vim Bar). The solver collapses items
that share a price into one representative — two items at the same price are
indistinguishable from the amount alone — so this is *not* an ambiguity demo:

| Amount | Baskets | Status | Top candidate |
|---|---|---|---|
| ₹20 | 1 | solved | 92% — 1× Bisleri Water 1 L |
| ₹40 | 1 | solved | 92% — 2× Bisleri Water 1 L |
| ₹60 | 2 | solved | 57% — 2× Good Day Biscuit |
| ₹90 | 3 | **ambiguous** | 49% — 2× Dairy Milk 50 g |
| ₹120 | 4 | **ambiguous** | 37% — 4× Good Day Biscuit |

Ten items sit at eight distinct price points, which the "How this was inferred" panel
reports. To show the app declining to commit, use **₹90 or ₹120**, not ₹20.

### Reproducing the measurement

`server/verifySamplePhotoOcr.mjs` covers the bundled samples only. This asset is external
by design, so it is measured with a throwaway variant of that harness rather than by adding
it to any sample list.
