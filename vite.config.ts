import { defineConfig } from 'vite'
import path from 'path'

export default defineConfig({
  base: './',
  server: {
    port: 8765,
  },
  build: {
    outDir: 'dist-editor',
    rollupOptions: {
      input: {
        main: path.resolve(__dirname, 'index.html'),
      },
    },
  },
})
