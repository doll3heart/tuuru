import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  root: path.resolve(__dirname, 'reader'),
  base: './',
  server: {
    port: 5678,
  },
  build: {
    outDir: path.resolve(__dirname, 'dist-reader'),
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'reader/index.html'),
      },
    },
  },
})