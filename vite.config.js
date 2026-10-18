import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  base: '/oceanblue/',
  plugins: [react()],
  build: { chunkSizeWarningLimit: 1400 },
  server: { port: 5180 },
})
