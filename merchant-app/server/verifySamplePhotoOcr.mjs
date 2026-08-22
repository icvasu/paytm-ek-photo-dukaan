/**
 * Runs the shipped catalog pipeline over the sample photos in `public/demo` and
 * prints what OCR actually read, row by row.
 *
 * Usage: node server/verifySamplePhotoOcr.mjs [photo-id ...]
 *
 * Why this exists: the sample rate-card photo is offered in the UI as a REAL
 * read, not a fixture. That claim is only credible if it is measured, so this
 * harness exercises the same three stages the browser does —
 *
 *   preprocess → tesseract.js → parseCatalogLines → resolveItems
 *
 * The parse and resolve stages are the app's own modules, loaded through Vite so
 * the TypeScript that ships is the TypeScript that runs here. Only the pixel
 * front-end is reimplemented, because `ocr.ts` reaches for `<canvas>` and
 * `Image`, which Node does not have. That reimplementation is deliberately a
 * line-by-line port of `preprocess()` in `src/services/vision/ocr.ts`:
 * greyscale with the same luminance weights, then the same min/max contrast
 * stretch behind the same `span > 24` guard.
 *
 * Both sample photos are 1536 px on the long edge, below the pipeline's 1600 px
 * cap, so the browser does not resample them either. Skipping resampling here is
 * therefore a match rather than a shortcut — the guard below fails loudly if a
 * future asset breaks that assumption.
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { deflateSync, inflateSync } from 'node:zlib'
import { execFileSync } from 'node:child_process'
import { createServer } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')

/* Mirrors the constants in src/services/vision/ocr.ts. */
const MAX_EDGE = 1600
const MIN_EDGE = 120

/* -------------------------------------------------------------------------- */
/* Minimal PNG codec                                                          */
/* -------------------------------------------------------------------------- */

/**
 * Decodes a non-interlaced 8-bit PNG to raw samples.
 *
 * Hand-rolled rather than added as a dependency: this runs on a developer
 * machine to check a claim, and a verification tool that drags in an image
 * library is a verification tool nobody installs.
 */
function decodePng(buffer) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  if (!buffer.subarray(0, 8).equals(signature)) throw new Error('not a PNG')

  let width = 0
  let height = 0
  let depth = 0
  let colorType = 0
  const idat = []

  for (let offset = 8; offset + 8 <= buffer.length;) {
    const length = buffer.readUInt32BE(offset)
    const type = buffer.toString('ascii', offset + 4, offset + 8)
    const data = buffer.subarray(offset + 8, offset + 8 + length)
    if (type === 'IHDR') {
      width = data.readUInt32BE(0)
      height = data.readUInt32BE(4)
      depth = data[8]
      colorType = data[9]
      if (data[12] !== 0) throw new Error('interlaced PNG is not supported')
    } else if (type === 'IDAT') {
      idat.push(Buffer.from(data))
    } else if (type === 'IEND') {
      break
    }
    offset += 12 + length
  }

  if (depth !== 8) throw new Error(`unsupported bit depth ${depth}`)
  const channels = { 0: 1, 2: 3, 4: 2, 6: 4 }[colorType]
  if (!channels) throw new Error(`unsupported colour type ${colorType}`)

  const raw = inflateSync(Buffer.concat(idat))
  const stride = width * channels
  const pixels = Buffer.alloc(height * stride)

  let cursor = 0
  for (let y = 0; y < height; y += 1) {
    const filter = raw[cursor]
    cursor += 1
    const row = raw.subarray(cursor, cursor + stride)
    cursor += stride
    const current = pixels.subarray(y * stride, (y + 1) * stride)
    const previous = y > 0 ? pixels.subarray((y - 1) * stride, y * stride) : null

    for (let x = 0; x < stride; x += 1) {
      const left = x >= channels ? current[x - channels] : 0
      const up = previous ? previous[x] : 0
      const upLeft = previous && x >= channels ? previous[x - channels] : 0
      let value = row[x]
      if (filter === 1) value += left
      else if (filter === 2) value += up
      else if (filter === 3) value += (left + up) >> 1
      else if (filter === 4) {
        const predictor = left + up - upLeft
        const dLeft = Math.abs(predictor - left)
        const dUp = Math.abs(predictor - up)
        const dUpLeft = Math.abs(predictor - upLeft)
        value += dLeft <= dUp && dLeft <= dUpLeft ? left : dUp <= dUpLeft ? up : upLeft
      } else if (filter !== 0) {
        throw new Error(`unsupported row filter ${filter}`)
      }
      current[x] = value & 0xff
    }
  }

  return { width, height, channels, pixels }
}

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

/** Encodes 8-bit greyscale samples as a PNG for the OCR engine to consume. */
function encodeGreyPng(width, height, grey) {
  const raw = Buffer.alloc(height * (width + 1))
  for (let y = 0; y < height; y += 1) {
    raw[y * (width + 1)] = 0
    for (let x = 0; x < width; x += 1) raw[y * (width + 1) + 1 + x] = grey[y * width + x]
  }
  const header = Buffer.alloc(13)
  header.writeUInt32BE(width, 0)
  header.writeUInt32BE(height, 4)
  header[8] = 8
  header[9] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

/* -------------------------------------------------------------------------- */
/* Preprocessing — a port of preprocess() in src/services/vision/ocr.ts       */
/* -------------------------------------------------------------------------- */

function preprocess({ width, height, channels, pixels }) {
  if (!width || !height) throw new Error('image has no readable pixels')
  if (Math.max(width, height) < MIN_EDGE) throw new Error('image is too small to read text from')

  const scale = Math.min(1, MAX_EDGE / Math.max(width, height))
  if (scale !== 1) {
    throw new Error(
      `this asset is ${width}×${height}, so the browser would downscale it by ${scale.toFixed(3)}. `
      + 'This harness does not resample, so its numbers would no longer describe the shipped path. '
      + `Shrink the asset to ${MAX_EDGE}px on the long edge and re-run.`,
    )
  }

  const grey = new Uint8Array(width * height)
  let min = 255
  let max = 0
  for (let pixel = 0; pixel < grey.length; pixel += 1) {
    const index = pixel * channels
    const r = pixels[index]
    const g = channels >= 3 ? pixels[index + 1] : r
    const b = channels >= 3 ? pixels[index + 2] : r
    const value = (r * 299 + g * 587 + b * 114) / 1000
    const rounded = value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
    grey[pixel] = rounded
    if (rounded < min) min = rounded
    if (rounded > max) max = rounded
  }

  const span = max - min
  for (let pixel = 0; pixel < grey.length; pixel += 1) {
    const stretched = span > 24 ? ((grey[pixel] - min) * 255) / span : grey[pixel]
    grey[pixel] = stretched < 0 ? 0 : stretched > 255 ? 255 : Math.round(stretched)
  }

  return { width, height, grey, contrastStretched: span > 24 }
}

/** sips is macOS-only, but it is only used to rasterise; PNG assets skip it. */
function rasterise(path) {
  if (path.toLowerCase().endsWith('.png')) return readFileSync(path)
  const target = resolve(projectRoot, 'node_modules/.tmp/ocr-verify-raster.png')
  execFileSync('sips', ['-s', 'format', 'png', path, '--out', target], { stdio: 'ignore' })
  return readFileSync(target)
}

/* -------------------------------------------------------------------------- */
/* OCR                                                                        */
/* -------------------------------------------------------------------------- */

/** Extracts lines exactly the way runOcr() does, including the flat-text fallback. */
function linesFrom(data) {
  const lines = []
  let confidenceWeight = 0
  let confidenceSum = 0
  for (const block of data.blocks ?? []) {
    for (const paragraph of block.paragraphs ?? []) {
      for (const line of paragraph.lines ?? []) {
        const text = String(line.text ?? '').replace(/\s+/g, ' ').trim()
        if (!text) continue
        const confidence = Number.isFinite(line.confidence) ? line.confidence : 0
        lines.push({ text, confidence })
        const weight = Math.max(1, line.words?.length ?? 1)
        confidenceWeight += weight
        confidenceSum += confidence * weight
      }
    }
  }
  const rawText = String(data.text ?? '').trim()
  if (!lines.length && rawText) {
    for (const text of rawText.split('\n').map((value) => value.replace(/\s+/g, ' ').trim())) {
      if (text) lines.push({ text, confidence: Number.isFinite(data.confidence) ? data.confidence : 0 })
    }
  }
  return { lines, meanConfidence: confidenceWeight ? Math.round(confidenceSum / confidenceWeight) : 0 }
}

const rupees = (paise) => `₹${(paise / 100).toFixed(2).replace(/\.00$/, '')}`

async function main() {
  const vite = await createServer({
    root: projectRoot,
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'error',
  })

  let failures = 0
  try {
    const { SAMPLE_PHOTOS } = await vite.ssrLoadModule('/src/services/vision/VisionService.ts')
    const { parseCatalogLines } = await vite.ssrLoadModule('/src/services/vision/parseCatalog.ts')
    const { resolveItems } = await vite.ssrLoadModule('/src/services/vision/resolveItems.ts')

    const wanted = process.argv.slice(2)
    const photos = wanted.length
      ? SAMPLE_PHOTOS.filter((photo) => wanted.includes(photo.id))
      : SAMPLE_PHOTOS
    if (!photos.length) {
      throw new Error(`no such sample photo. Known: ${SAMPLE_PHOTOS.map((p) => p.id).join(', ')}`)
    }

    const tesseract = await import('tesseract.js')
    const langPath = resolve(projectRoot, 'public/tesseract')

    for (const photo of photos) {
      const path = resolve(projectRoot, 'public', photo.imagePath.replace(/^\//, ''))
      if (!existsSync(path)) throw new Error(`missing asset ${path}`)

      console.log(`\n${'='.repeat(78)}\n${photo.id}\n${'='.repeat(78)}`)
      console.log(`file            ${photo.imagePath} (${(statSync(path).size / 1024).toFixed(0)} KB on disk)`)

      const frame = preprocess(decodePng(rasterise(path)))
      console.log(`fed to engine   ${frame.width}×${frame.height} greyscale`
        + `${frame.contrastStretched ? ', contrast stretched' : ', contrast left alone (flat image)'}`)
      console.log(`expectation     ${photo.expectation}`)

      const worker = await tesseract.createWorker('eng', 1, {
        langPath, gzip: true, legacyCore: false, legacyLang: false,
        cachePath: resolve(projectRoot, 'node_modules/.tmp'),
      })

      let outcome
      const startedAt = Date.now()
      try {
        await worker.setParameters({
          tessedit_pageseg_mode: tesseract.PSM.SINGLE_COLUMN,
          preserve_interword_spaces: '1',
        })
        const result = await worker.recognize(
          encodeGreyPng(frame.width, frame.height, frame.grey), {}, { text: true, blocks: true },
        )
        outcome = linesFrom(result.data)
      } finally {
        await worker.terminate().catch(() => undefined)
      }
      const durationMs = Date.now() - startedAt

      const parse = parseCatalogLines(outcome.lines)
      console.log(`\nOCR             ${outcome.lines.length} lines, mean text confidence `
        + `${outcome.meanConfidence}%, ${(durationMs / 1000).toFixed(1)}s`)
      console.log(`parse           ${parse.items.length} priced rows kept, ${parse.rejected.length} skipped`)

      if (!parse.items.length) {
        console.log('\nNo priced rows. The pipeline throws NoTextFoundError here, which is the')
        console.log('honest outcome for a photo with no readable price list.')
      } else {
        const resolved = resolveItems(parse.items)
        const matched = resolved.filter((item) => item.matched).length
        console.log(`resolve         ${matched} of ${resolved.length} matched a lexicon product\n`)
        console.log(`  ${'#'.padEnd(3)}${'item'.padEnd(30)}${'price'.padEnd(10)}${'conf'.padEnd(7)}`
          + `${'matched'.padEnd(9)}read as`)
        console.log(`  ${'-'.repeat(96)}`)
        resolved.forEach((item, index) => {
          console.log(`  ${String(index + 1).padEnd(3)}${item.name.slice(0, 29).padEnd(30)}`
            + `${rupees(item.pricePaise).padEnd(10)}${`${item.confidencePct}%`.padEnd(7)}`
            + `${(item.matched ? 'yes' : 'NO').padEnd(9)}${JSON.stringify(item.evidence.ocrText)}`)
        })
      }

      if (parse.rejected.length) {
        console.log('\n  skipped lines and why:')
        for (const row of parse.rejected) console.log(`    ${JSON.stringify(row.text).padEnd(48)} ${row.reason}`)
      }

      /* The expectation is reported, never enforced on the parser. A mismatch is
       * a finding to look at, not a reason to tune the parser until it agrees. */
      const readable = parse.items.length > 0
      const met = photo.expectation === 'reads_prices' ? readable : !readable
      if (!met) {
        failures += 1
        console.log(`\n  NOTE  this photo is offered as "${photo.expectation}" but the real read `
          + `${readable ? 'did produce' : 'produced no'} priced rows.`)
      }
    }
  } finally {
    await vite.close()
  }

  console.log(`\n${failures ? `${failures} photo(s) disagreed with the label the UI shows.` : 'Every sample photo behaved as the UI labels it.'}`)
  process.exit(failures ? 1 : 0)
}

main().catch((reason) => {
  console.error(reason)
  process.exit(1)
})
