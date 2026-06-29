import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const buildTarget = process.env.VITE_BUILD || 'editor'
const isReader = buildTarget === 'reader'

const inputConfig = isReader
  ? { main: path.resolve(__dirname, 'reader/index.html') }
  : { main: path.resolve(__dirname, 'index.html') }

const outDir = isReader ? 'dist-reader' : 'dist-editor'

export default defineConfig({
  plugins: isReader ? [] : [react(), tailwindcss()],
  resolve: isReader ? {} : {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  root: isReader ? path.resolve(__dirname, 'reader') : undefined,
  base: './',
  server: {
    port: 8765,
  },
  build: {
    outDir: isReader ? path.resolve(__dirname, 'dist-reader') : outDir,
    rollupOptions: {
      input: inputConfig,
    },
  },
})
