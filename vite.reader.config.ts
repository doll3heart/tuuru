import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, 'reader'),
  base: './',
  cacheDir: path.resolve(__dirname, '.vite/reader'),
  server: {
    port: 5678,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-reader'),
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'reader/index.html'),
      },
    },
  },
})
