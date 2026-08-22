/**
 * tesseract.js is loaded with a dynamic import inside `runOcr`, never at module
 * scope. Most of the app never scans a photo, and a static import would put the
 * engine shim in the initial bundle — paid for on first paint by every visitor,
 * including a customer who only opened the public dukaan on their phone.
 */
type TesseractWorker = Awaited<ReturnType<typeof import('tesseract.js').createWorker>>

export interface OcrLine {
  text: string
  /** Tesseract's own 0–100 confidence for the line. */
  confidence: number
}

export interface OcrOutcome {
  engine: 'tesseract.js'
  lines: OcrLine[]
  rawText: string
  /** Word count weighted mean of line confidence. 0 when nothing was read. */
  meanConfidence: number
  durationMs: number
  /** Pixel size actually fed to the engine after downscaling. */
  processedWidth: number
  processedHeight: number
}

export interface OcrPhase {
  /** 0..1 across the whole run, so the bar cannot go backwards. */
  progress: number
  label: string
}

export class OcrUnavailableError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OcrUnavailableError'
  }
}

const CORE_PATH = '/tesseract'
const LANG_PATH = '/tesseract'
const WORKER_PATH = '/tesseract/worker.min.js'

/** Long edge fed to Tesseract. Bigger is slower with no accuracy gain here. */
const MAX_EDGE = 1600
/** Below this the photo has too few pixels for the engine to read text. */
const MIN_EDGE = 120
const OCR_TIMEOUT_MS = 45_000

function decodeImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new globalThis.Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('This file could not be decoded as an image.'))
    }
    image.src = url
  })
}

/**
 * Downscale, greyscale and stretch contrast. Shop photos are noisy and often
 * 12 MP; this is the single biggest accuracy and speed win before OCR.
 */
function preprocess(image: HTMLImageElement) {
  const naturalWidth = image.naturalWidth || image.width
  const naturalHeight = image.naturalHeight || image.height
  if (!naturalWidth || !naturalHeight) throw new Error('This image has no readable pixels.')
  if (Math.max(naturalWidth, naturalHeight) < MIN_EDGE) {
    throw new Error('This image is too small to read any text from.')
  }

  const scale = Math.min(1, MAX_EDGE / Math.max(naturalWidth, naturalHeight))
  const width = Math.max(1, Math.round(naturalWidth * scale))
  const height = Math.max(1, Math.round(naturalHeight * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext('2d', { willReadFrequently: true })
  if (!context) throw new Error('This browser blocked canvas access, so OCR cannot run.')
  context.drawImage(image, 0, 0, width, height)

  const frame = context.getImageData(0, 0, width, height)
  const pixels = frame.data
  const luminance = new Uint8Array(width * height)
  let min = 255
  let max = 0
  for (let index = 0, pixel = 0; index < pixels.length; index += 4, pixel += 1) {
    const value = (pixels[index] * 299 + pixels[index + 1] * 587 + pixels[index + 2] * 114) / 1000
    const rounded = value < 0 ? 0 : value > 255 ? 255 : Math.round(value)
    luminance[pixel] = rounded
    if (rounded < min) min = rounded
    if (rounded > max) max = rounded
  }

  const span = max - min
  for (let pixel = 0, index = 0; pixel < luminance.length; pixel += 1, index += 4) {
    const stretched = span > 24 ? ((luminance[pixel] - min) * 255) / span : luminance[pixel]
    const value = stretched < 0 ? 0 : stretched > 255 ? 255 : stretched
    pixels[index] = value
    pixels[index + 1] = value
    pixels[index + 2] = value
    pixels[index + 3] = 255
  }
  context.putImageData(frame, 0, 0)
  return { canvas, width, height }
}

function phaseFor(status: string, progress: number): OcrPhase {
  // Tesseract reports several 0→1 sub-phases. Map them onto one monotonic bar.
  if (status.includes('worker') || status.includes('core')) {
    return { progress: 0.05 + progress * 0.2, label: 'Starting the on-device reader' }
  }
  if (status.includes('language') || status.includes('traineddata') || status.includes('initializ')) {
    return { progress: 0.25 + progress * 0.25, label: 'Loading the English text model' }
  }
  if (status.includes('recognizing')) {
    return { progress: 0.55 + progress * 0.44, label: 'Reading text from your photo' }
  }
  return { progress: 0.05, label: 'Preparing your photo' }
}

/**
 * Runs Tesseract LSTM OCR entirely in the browser on the user's own photo.
 * No image ever leaves the device and no API key or paid service is involved.
 *
 * Throws OcrUnavailableError when the engine itself cannot start, so callers can
 * offer manual entry instead of pretending a read succeeded.
 */
export async function runOcr(file: Blob, onPhase?: (phase: OcrPhase) => void): Promise<OcrOutcome> {
  const startedAt = Date.now()
  onPhase?.({ progress: 0.02, label: 'Preparing your photo' })

  const image = await decodeImage(file)
  const { canvas, width, height } = preprocess(image)

  let highWaterMark = 0
  const report = (phase: OcrPhase) => {
    if (phase.progress <= highWaterMark) return
    highWaterMark = phase.progress
    onPhase?.(phase)
  }

  let worker: TesseractWorker | null = null
  // Kept in scope for PSM below. A failed chunk fetch on a bad venue network
  // lands in the same catch as a failed engine start, which is the honest
  // outcome either way: OCR is unavailable, so offer manual entry.
  let tesseract: typeof import('tesseract.js') | null = null
  try {
    tesseract = await import('tesseract.js')
    worker = await tesseract.createWorker('eng', 1, {
      corePath: CORE_PATH,
      langPath: LANG_PATH,
      workerPath: WORKER_PATH,
      gzip: true,
      legacyCore: false,
      legacyLang: false,
      logger: (message) => report(phaseFor(String(message.status ?? ''), Number(message.progress) || 0)),
    })
  } catch (reason) {
    throw new OcrUnavailableError(
      reason instanceof Error && reason.message
        ? `The on-device text reader could not start (${reason.message}).`
        : 'The on-device text reader could not start.',
    )
  }

  try {
    // SINGLE_COLUMN suits shelf labels and printed rate cards: one vertical
    // run of name/price rows at mixed sizes.
    await worker.setParameters({
      tessedit_pageseg_mode: tesseract.PSM.SINGLE_COLUMN,
      preserve_interword_spaces: '1',
    })

    const result = await Promise.race([
      worker.recognize(canvas, {}, { text: true, blocks: true }),
      new Promise<never>((_, reject) => {
        globalThis.setTimeout(
          () => reject(new Error('Reading this photo took too long. Try a closer, brighter shot.')),
          OCR_TIMEOUT_MS,
        )
      }),
    ])

    const lines: OcrLine[] = []
    let confidenceWeight = 0
    let confidenceSum = 0
    for (const block of result.data.blocks ?? []) {
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

    const rawText = String(result.data.text ?? '').trim()
    // Some builds omit block geometry; fall back to splitting the flat text so a
    // successful read is never thrown away.
    if (!lines.length && rawText) {
      for (const text of rawText.split('\n').map((value) => value.replace(/\s+/g, ' ').trim())) {
        if (text) lines.push({ text, confidence: Number.isFinite(result.data.confidence) ? result.data.confidence : 0 })
      }
    }

    return {
      engine: 'tesseract.js',
      lines,
      rawText,
      meanConfidence: confidenceWeight ? Math.round(confidenceSum / confidenceWeight) : 0,
      durationMs: Date.now() - startedAt,
      processedWidth: width,
      processedHeight: height,
    }
  } finally {
    await worker.terminate().catch(() => undefined)
  }
}
