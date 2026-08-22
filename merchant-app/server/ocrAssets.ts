import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = resolve(here, '..')
const targetDir = resolve(projectRoot, 'public/tesseract')

/**
 * Runtime files tesseract.js fetches over HTTP. Serving them from our own origin
 * keeps OCR working on a venue network that cannot reach a CDN.
 *
 * The three core variants cover the browser feature-detection branches
 * (plain wasm, SIMD, relaxed SIMD) for the LSTM-only engine we initialise.
 */
const RUNTIME_ASSETS = [
  'tesseract.js/dist/worker.min.js',
  'tesseract.js-core/tesseract-core-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-simd-lstm.wasm.js',
  'tesseract.js-core/tesseract-core-relaxedsimd-lstm.wasm.js',
]

function copyRuntimeAssets() {
  mkdirSync(targetDir, { recursive: true })
  const missing: string[] = []
  for (const asset of RUNTIME_ASSETS) {
    const source = resolve(projectRoot, 'node_modules', asset)
    const target = resolve(targetDir, asset.split('/').pop() ?? '')
    if (!existsSync(source)) {
      missing.push(asset)
      continue
    }
    const sourceStat = statSync(source)
    if (existsSync(target) && statSync(target).size === sourceStat.size) continue
    copyFileSync(source, target)
  }
  return missing
}

/**
 * Copies the tesseract.js worker and WASM cores into `public/tesseract` for both
 * `vite dev` and `vite build`. They come from node_modules (pinned by
 * package-lock) so they are never committed, unlike the language model which is
 * not published to npm and is checked in.
 */
export function ocrAssetsPlugin(): Plugin {
  return {
    name: 'paytm-ek-photo-dukaan-ocr-assets',
    buildStart() {
      const missing = copyRuntimeAssets()
      if (missing.length) {
        this.warn(`OCR runtime assets missing from node_modules: ${missing.join(', ')}. Run npm install.`)
      }
    },
  }
}
