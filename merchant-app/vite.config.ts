import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { demoApiPlugin } from './server/demoApi.js'

export default defineConfig({
  plugins: [react(), demoApiPlugin()],
})
