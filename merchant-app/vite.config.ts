import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { demoApiPlugin } from './server/demoApi.js'
import { ocrAssetsPlugin } from './server/ocrAssets.js'

export default defineConfig({
  plugins: [react(), demoApiPlugin(), ocrAssetsPlugin()],
})
