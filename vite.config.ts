import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  base: './',
  cacheDir: path.resolve(__dirname, '.vite/editor'),
  server: {
    port: 8765,
  },
  build: {
    outDir: 'dist-editor',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
        reader: path.resolve(__dirname, 'reader/index.html'),
      },
    },
  },
})
